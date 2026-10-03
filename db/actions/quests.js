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
import { getTodayDateString, getAgeTierForLeague } from '../../utils.js';
import { callGeminiApiDetailed } from '../../api.js';
import { syncQuestAssignmentToParentHomework } from '../../utils/adminRuntime.js';
import { withActiveScoreYear, withSchoolYear } from '../../utils/schoolYear.js';
import { nextHeroOfDayWinWrite, getYearLegendContextFromState } from '../../utils/yearLegend.js';
import { classUsesTests } from '../../features/assessmentConfig.js';
import { PAGE_AWAITING, PAGE_WRITTEN, buildAwaitingPagePayload, isAwaitingAdventurePage } from '../../features/adventurePageCore.mjs';

const ADVENTURE_LOG_AI_RETRY_DELAYS_MS = [30000, 90000, 240000];

// --- REVAMPED: QUEST ASSIGNMENT (SINGLE ENTRY) ---

export async function handleSaveQuestAssignment() {
    const classId = document.getElementById('quest-assignment-class-id').value;
    const rawText = document.getElementById('quest-assignment-textarea').value.trim();

    // New Fields from Form
    const formTestDate = document.getElementById('quest-test-date').value;
    const formTestTitle = document.getElementById('quest-test-title').value;
    const formCurriculum = document.getElementById('quest-test-curriculum').value;
    const classData = state.get('allSchoolClasses').find((item) => item.id === classId)
        || state.get('allTeachersClasses').find((item) => item.id === classId)
        || null;

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

        // 1. Look up existing assignments from already-loaded state (avoids a slow Firestore query)
        const existingDocs = (state.get('allQuestAssignments') || [])
            .filter(a => a.classId === classId && a.createdBy?.uid === state.get('currentUserId'))
            .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

        let testDataToSave = null;
        const existingTest = existingDocs.length > 0 ? existingDocs[0].testData : null;
        const usesTests = classUsesTests(classData);

        // LOGIC: Determine which Test Data to use
        if (usesTests && formTestDate && formTestTitle) {
            // A. User entered a NEW test in the form -> Use it
            testDataToSave = { date: formTestDate, title: formTestTitle, curriculum: formCurriculum || '' };
        } else if (usesTests && existingTest) {
            // B. User left form blank, but there was an OLD test. Check if it's still in the future.
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const oldTestDate = new Date(existingTest.date);
            oldTestDate.setHours(0, 0, 0, 0);

            // Keep it if it is Today or in the Future
            if (oldTestDate >= today) {
                testDataToSave = existingTest;
            }
        }

        const batch = writeBatch(db);

        // Clean up old assignments using IDs from state (no extra Firestore read needed)
        existingDocs.forEach(a => batch.delete(doc(db, `${publicDataPath}/quest_assignments`, a.id)));

        const newDocRef = doc(collection(db, `${publicDataPath}/quest_assignments`));
        batch.set(newDocRef, withSchoolYear({
            classId,
            text,
            testData: testDataToSave, // Saves either the new one OR the preserved old one
            createdAt: serverTimestamp(),
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
        }, state.getActiveSchoolYearKey()));

        await batch.commit();

        const optimisticAssignment = {
            id: newDocRef.id,
            classId,
            text,
            testData: testDataToSave,
            schoolYearKey: state.getActiveSchoolYearKey(),
            createdAt: { seconds: Math.floor(Date.now() / 1000) },
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') }
        };
        const existingAssignmentIds = new Set(existingDocs.map(a => a.id));
        const nextAssignments = (state.get('allQuestAssignments') || [])
            .filter((assignment) => !existingAssignmentIds.has(assignment.id))
            .concat(optimisticAssignment);
        state.setAllQuestAssignments(nextAssignments);
        import('../../features/bookProgress.js').then(m => m.updateBookProgressFromAssignment({
            classId, text, assignmentId: newDocRef.id,
            previous: existingDocs[0] ? { id: existingDocs[0].id, text: existingDocs[0].text || '', date: existingDocs[0].createdAt?.seconds ? utils.getLocalIsoDateString(new Date(existingDocs[0].createdAt.seconds * 1000)) : null } : null
        })).then(() => import('../../features/campfire/campfireService.js').then(m => m.prepareCampfireFromAssignment(classId)))
            .catch(error => showToast('Assignment saved; book progress could not be saved: ' + error.message, 'error'));

        showToast("Quest assignment updated!", "success");
        import('../../ui/modals.js').then(m => m.hideModal('quest-assignment-modal'));

        syncQuestAssignmentToParentHomework({
            classId,
            text,
            lessonDate: testDataToSave?.date || getTodayDateString(),
            title: testDataToSave?.title || (classData?.name ? `${classData.name} Homework` : 'Quest Assignment'),
            testData: testDataToSave
        }).catch((syncError) => {
            console.error('Error syncing quest assignment to parent homework:', syncError);
            showToast('Quest assignment saved, but parent homework did not sync.', 'error');
        });

    } catch (error) {
        console.error("Error updating quest assignment:", error);
        showToast("Failed to save assignment.", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = 'Save Assignment';
    }
}

/**
 * The Adventure Log's main button. Crown first: one press picks and reveals Hero of the Day
 * and saves today's page blank (`pageStatus: 'awaiting'`); after Huzzah! the "Today's Page"
 * chooser offers Auto (AI Chronicler) or Manual. Pressed again later it reopens that chooser,
 * and once the page is written it turns to the page.
 */
export async function handleLogAdventure() {
    const classId = state.get('currentLogFilter').classId;
    if (!classId) return;

    const { canUseFeature } = await import('../../utils/subscription.js');
    if (!canUseFeature('adventureLog')) {
        const { showUpgradePrompt } = await import('../../utils/upgradePrompt.js');
        const { getUpgradeMessage } = await import('../../config/tiers/features.js');
        showUpgradePrompt({ feature: 'Adventure Log', tier: 'Pro', message: getUpgradeMessage('Pro', 'adventureLog') });
        return;
    }

    const classData = state.get('allTeachersClasses').find(c => c.id === classId);
    if (!classData) return;

    const today = getTodayDateString();
    // Until the snapshot brings a page we just crowned, remember it so a second press cannot crown twice.
    const justCrowned = recentlyCrowned.get(classId);
    const existingLog = state.get('allAdventureLogs').find(log => log.classId === classId && log.date === today)
        || (justCrowned?.date === today && Date.now() - justCrowned.at < 15000 ? { id: justCrowned.logId, pageStatus: PAGE_AWAITING } : null);
    if (crowningClassIds.has(classId)) return;
    if (existingLog) {
        if (isAwaitingAdventurePage(existingLog)) {
            import('../../ui/modals/diaryChooser.js').then(m => m.openDiaryChooser(existingLog.id)).catch(() => {});
        } else {
            import('../../ui/tabs/log.js').then(m => m.focusDiaryPage(existingLog.id)).catch(() => {});
        }
        return;
    }

    const classStudents = state.get('allStudents').filter(s => s.classId === classId);
    const todaysStars = state.get('todaysStars') || {};
    const hasAwardedStarsToday = classStudents.some(s => (Number(todaysStars[s.id]?.stars) || 0) > 0);
    if (!hasAwardedStarsToday) {
        showToast("Award stars to this class first, then crown today's Hero.", "info");
        return;
    }

    // Local bank only: this must never queue an AI request in front of the Chronicler.
    import('../../features/campfire/campfireService.js').then(m => m.kindleCampfire(classId)).catch(() => {});
    await crownHeroOfTheDay(classId, classData);
}

const crowningClassIds = new Set();
const recentlyCrowned = new Map();

function setCrownButtonBusy(busy) {
    const btn = document.getElementById('log-adventure-btn');
    if (!btn) return;
    if (busy) {
        btn.dataset.busy = '1';
        btn.disabled = true;
        btn.innerHTML = `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>Summoning the crown…</span>`;
        return;
    }
    delete btn.dataset.busy;
    import('../../ui/tabs/log.js').then(m => m.syncAdventureLogTodayControls()).catch(() => {});
}

async function crownHeroOfTheDay(classId, classData) {
    if (crowningClassIds.has(classId)) return;
    crowningClassIds.add(classId);
    setCrownButtonBusy(true);
    try {
        const lessonDate = getTodayDateString();
        const presentStudents = getPresentStudentsForClass(classId);
        const classRef = doc(db, 'artifacts/great-class-quest/public/data/classes', classId);
        const [learnedModule, reasonMeta] = await Promise.all([
            import('../../features/learnedToday.js'),
            import('../../features/awardLogReasonMeta.js')
        ]);
        const [heroSelection, learnedToday] = await Promise.all([
            _selectHeroOfTheDay(classId, presentStudents, classRef, getDoc(classRef)),
            learnedModule.gatherLearnedToday(classId)
        ]);
        const todaysAwards = (state.get('allAwardLogs') || []).filter(a => a.classId === classId && utils.datesMatch(a.date, lessonDate));
        const totalStars = todaysAwards.reduce((sum, a) => sum + reasonMeta.getAwardLogMonthlyStarCredit(a) + reasonMeta.getClassQuestBonusStarsFromAwardLog(a), 0);
        const reasonLabels = [...new Set(todaysAwards.filter(a => a.reason !== 'marked_present').map(a => a.reason?.replaceAll('_', ' ')).filter(Boolean))];

        const logId = await saveAdventureLogWithHeroWin({
            classId,
            date: lessonDate,
            ...buildAwaitingPagePayload({ heroName: heroSelection.heroName }),
            hero: heroSelection.heroName,
            heroStudentId: heroSelection.heroStudentId || null,
            pageStatus: PAGE_AWAITING,
            entryMode: '',
            ageTier: _getAgeTierFromLeague(classData.questLevel),
            imageUrl: null,
            topReason: reasonLabels[0] || 'excellence',
            totalStars,
            learnedToday,
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
            createdAt: serverTimestamp()
        }, heroSelection.heroStudentId);
        recentlyCrowned.set(classId, { date: lessonDate, logId, at: Date.now() });

        await showHeroOfTheDayReveal(
            heroSelection.heroStudentId,
            'The Class Hero!',
            { classId, logId, studentId: heroSelection.heroStudentId, learnedToday },
            { diaryLogId: logId }
        );
    } catch (error) {
        console.error('Crowning Hero of the Day failed:', error);
        showToast('The crown could not be placed. Please try again.', 'error');
    } finally {
        crowningClassIds.delete(classId);
        setCrownButtonBusy(false);
    }
}

/**
 * Auto: hands a crowned, still-blank page to the AI Chronicler. Resolves once the page is
 * claimed (status "Being written"); the text and artwork finish in the background with the
 * usual retries. Throws a teacher-readable message when the page cannot be started.
 */
export async function writeAdventurePageWithChronicler(logId, { onStatus } = {}) {
    const { canUseFeature } = await import('../../utils/subscription.js');
    if (!canUseFeature('eliteAI')) throw new Error('The AI Chronicler is part of the Elite plan.');

    const logRef = doc(db, 'artifacts/great-class-quest/public/data/adventure_logs', logId);
    const snap = await getDoc(logRef);
    if (!snap.exists()) throw new Error('This diary page could not be found.');
    const log = { id: snap.id, ...snap.data() };
    if (log.createdBy?.uid !== state.get('currentUserId') || log.schoolYearKey !== state.getActiveSchoolYearKey()) {
        throw new Error('This diary page belongs to another teacher or school year.');
    }
    if (!isAwaitingAdventurePage(log)) throw new Error('This page has already been written.');
    const classData = state.get('allTeachersClasses').find(c => c.id === log.classId);
    if (!classData) throw new Error('Could not load this class.');

    onStatus?.("Gathering today's stars, words and moments.");
    const [{ gatherAdventureLogContext }, { buildChroniclerPrompts }, reasonMeta] = await Promise.all([
        import('../../features/adventureLogContext.js'),
        import('../../features/adventureLogContextCore.mjs'),
        import('../../features/awardLogReasonMeta.js')
    ]);
    const heroOfTheDay = log.hero || 'The Class Team';
    const gathered = await gatherAdventureLogContext(log.classId, { date: log.date, hero: heroOfTheDay });
    const lessonDate = log.date;
    const ageTier = _getAgeTierFromLeague(gathered.classData?.questLevel || classData.questLevel);
    const todaysAwards = gathered.awards.filter(a => a.classId === log.classId && utils.datesMatch(a.date, lessonDate));
    const totalStars = todaysAwards.reduce((sum, a) => sum + reasonMeta.getAwardLogMonthlyStarCredit(a) + reasonMeta.getClassQuestBonusStarsFromAwardLog(a), 0);
    const reasonLabels = [...new Set(todaysAwards.filter(a => a.reason !== 'marked_present').map(a => a.reason?.replaceAll('_', ' ')).filter(Boolean))];
    const context = { ...gathered.context, hero: heroOfTheDay };
    const learnedToday = (gathered.learnedToday?.items?.length || gathered.learnedToday?.words?.length)
        ? gathered.learnedToday
        : (log.learnedToday || gathered.learnedToday || { items: [], words: [], summary: '' });
    const aiPrompts = buildChroniclerPrompts(context);
    const requestId = crypto.randomUUID();
    const placeholderDiary = buildAdventureLogPlaceholder({
        className: gathered.classData?.name || classData.name,
        heroOfTheDay,
        totalStars,
        topReasonsStr: reasonLabels.join(', ') || 'shared effort',
        reasonLabels,
        early: context.early
    });

    onStatus?.('The Chronicler takes up the quill.');
    const claimed = await runTransaction(db, async tx => {
        const fresh = await tx.get(logRef);
        if (!fresh.exists()) throw new Error('This diary page could not be found.');
        const data = fresh.data();
        if (data.createdBy?.uid !== state.get('currentUserId') || data.schoolYearKey !== state.getActiveSchoolYearKey()) {
            throw new Error('This diary page belongs to another teacher or school year.');
        }
        if (!isAwaitingAdventurePage(data)) return false;
        tx.update(logRef, {
            pageStatus: PAGE_WRITTEN,
            entryMode: 'ai',
            title: placeholderDiary.title,
            text: placeholderDiary.entry,
            highlights: placeholderDiary.highlights,
            keywords: placeholderDiary.keywords,
            ageTier,
            topReason: reasonLabels[0] || data.topReason || 'excellence',
            totalStars,
            learnedToday,
            chroniclerContext: context,
            generationRequestId: requestId,
            generationStatus: 'generating',
            generationProvider: '',
            generationAttempts: 0,
            pendingRetryAt: null,
            generationError: '',
            generationSummary: describeAdventureLogGenerationStatus('generating'),
            generationUpdatedAt: serverTimestamp(),
            writtenAt: serverTimestamp()
        });
        return true;
    });
    if (!claimed) throw new Error('This page has already been written.');

    runChroniclerInBackground({
        logId,
        aiPrompts,
        context,
        requestId,
        classData: gathered.classData || classData,
        heroOfTheDay,
        ageTier,
        reasonLabels,
        totalStars
    });
    return { logId };
}

/** Fire-and-forget: AI text + artwork, then the automatic retry ladder if the first attempt fails. */
function runChroniclerInBackground(payload) {
    const { logId, requestId } = payload;
    finalizeAdventureLogGeneration({ ...payload, attemptNumber: 1, allowArtwork: true }).then(result => {
        if (!result.superseded) showToast('The adventure has been chronicled. Artwork will appear when ready.', 'success');
    }).catch(async (error) => {
        console.error('Chronicler text generation failed:', error);
        const firstRetryDelay = ADVENTURE_LOG_AI_RETRY_DELAYS_MS[0] || null;
        const queued = await updateAdventureLogGenerationState(logId, {
            generationStatus: firstRetryDelay ? 'pending' : 'failed',
            generationAttempts: 1,
            generationError: String(error?.message || 'AI generation failed.'),
            pendingRetryAt: firstRetryDelay ? new Date(Date.now() + firstRetryDelay).toISOString() : null,
            generationUpdatedAt: serverTimestamp(),
            generationSummary: describeAdventureLogGenerationStatus(firstRetryDelay ? 'pending' : 'failed')
        }, requestId);
        if (!queued) return;

        if (firstRetryDelay) {
            scheduleAdventureLogRetry({ ...payload, initialAttemptNumber: 1 }, firstRetryDelay, 0);
            showToast('Chronicler AI is busy. The entry is saved and will retry automatically.', 'info');
        } else {
            showToast('Chronicler AI could not finish this entry yet.', 'error');
        }
    });
}

function buildAdventureLogPlaceholder({
    className,
    heroOfTheDay,
    totalStars,
    topReasonsStr,
    reasonLabels,
    early = false
}) {
    const title = `${className} Chronicle`;
    const entry = `${className}'s chronicle is being woven by the Chronicler. Hero of the Day: ${heroOfTheDay}. ${early ? `We shared a lesson full of ${topReasonsStr}.` : `${totalStars} stars were earned through ${topReasonsStr}.`}`;
    const highlights = [
        early ? 'A day of shared effort' : `${totalStars} stars earned`,
        `Skills shown: ${topReasonsStr}`,
        `Hero of the Day: ${heroOfTheDay}`
    ].slice(0, 3);
    const keywords = [
        ...reasonLabels,
        'chronicle',
        'hero_of_the_day',
        'class_quest'
    ]
        .map((keyword) => String(keyword).toLowerCase().replace(/\s+/g, '_'))
        .filter(Boolean)
        .slice(0, 6);

    return {
        title,
        entry,
        highlights,
        keywords
    };
}

function describeAdventureLogGenerationStatus(status) {
    switch (status) {
        case 'retrying':
            return 'The Chronicler is trying another path to finish this entry.';
        case 'pending':
            return 'The entry is saved and waiting for the Chronicler to finish it.';
        case 'failed':
            return 'The Chronicler could not finish this entry yet.';
        case 'ready':
            return 'The Chronicler has completed this entry.';
        case 'generating':
        default:
            return 'The Chronicler is weaving this entry right now.';
    }
}

async function updateAdventureLogGenerationState(logId, updates, expectedRequestId = null) {
    const logRef = doc(db, 'artifacts/great-class-quest/public/data/adventure_logs', logId);
    return runTransaction(db, async tx => {
        const snap = await tx.get(logRef);
        if (!snap.exists() || (expectedRequestId && snap.data().generationRequestId !== expectedRequestId)) return false;
        if (snap.data().createdBy?.uid !== state.get('currentUserId') || snap.data().schoolYearKey !== state.getActiveSchoolYearKey()) return false;
        tx.update(logRef, updates);
        return true;
    });
}

async function buildAdventureLogRetryPromptsFromLog(log, classData, options = {}) {
    const { buildChroniclerPrompts, ADVENTURE_CONTEXT_VERSION } = await import('../../features/adventureLogContextCore.mjs');
    let context = log.chroniclerContext;
    // Older snapshots mixed background into "today" (e.g. a prepared Campfire and its next question): rebuild them.
    if (!context?.version || context.version < ADVENTURE_CONTEXT_VERSION) {
        const { gatherAdventureLogContext } = await import('../../features/adventureLogContext.js');
        context = (await gatherAdventureLogContext(log.classId, { date: log.date, hero: log.hero })).context;
        await updateAdventureLogGenerationState(log.id, { chroniclerContext: context });
    }
    // Only a draft the teacher typed is a draft. The saved text of an AI page is the Chronicler's
    // own earlier output, and feeding it back would carry its mistakes into the retry.
    return { ...buildChroniclerPrompts(context, { previousText: options.previousText || '' }), context,
        ageTier: log.ageTier || _getAgeTierFromLeague(classData.questLevel),
        heroOfTheDay: log.hero || 'The Class Team', totalStars: Number(log.totalStars) || 0 };
}

export async function retryAdventureLogGeneration(logId, options = {}) {
    const { allowArtwork = true } = options || {};
    if (!logId) return;
    const { canUseFeature } = await import('../../utils/subscription.js');
    if (!canUseFeature('eliteAI')) throw new Error('The AI Chronicler requires Elite.');

    const existing = (state.get('allAdventureLogs') || []).find((l) => l.id === logId) || null;
    const logRef = doc(db, 'artifacts/great-class-quest/public/data/adventure_logs', logId);
    let resolvedLog = existing;
    {
        const snap = await getDoc(logRef);
        if (!snap.exists()) {
            showToast('Could not find that Adventure Log entry.', 'error');
            return;
        }
        resolvedLog = { id: snap.id, ...snap.data() };
    }
    if (!resolvedLog) {
        showToast('Could not find that Adventure Log entry.', 'error');
        return;
    }

    const entryMode = String(resolvedLog?.entryMode || '').toLowerCase();
    if (entryMode !== 'ai') {
        showToast('Only AI-written Adventure Log entries can be retried.', 'info');
        return;
    }

    const classId = resolvedLog.classId;
    const classData = state.get('allSchoolClasses').find((c) => c.id === classId)
        || state.get('allTeachersClasses').find((c) => c.id === classId)
        || null;
    if (!classData) {
        showToast('Could not load class data to retry this entry.', 'error');
        return;
    }

    if (resolvedLog.createdBy?.uid !== state.get('currentUserId') || resolvedLog.schoolYearKey !== state.getActiveSchoolYearKey()) {
        throw new Error('This diary belongs to another teacher or school year.');
    }
    resolvedLog.id = logId;
    const retryMeta = await buildAdventureLogRetryPromptsFromLog(resolvedLog, classData, options);
    const requestId = crypto.randomUUID();

    await updateAdventureLogGenerationState(logId, {
        generationStatus: 'retrying',
        generationRequestId: requestId,
        pendingRetryAt: null,
        generationError: '',
        generationUpdatedAt: serverTimestamp(),
        generationSummary: describeAdventureLogGenerationStatus('retrying')
    });

    try {
        const reasonLabels = Array.isArray(resolvedLog?.keywords) ? resolvedLog.keywords : [];
        const alreadyHasArtwork = !!resolvedLog.imageUrl;
        const shouldAllowArtwork = allowArtwork && !alreadyHasArtwork;

        const result = await finalizeAdventureLogGeneration({
            logId,
            aiPrompts: { systemPrompt: retryMeta.systemPrompt, userPrompt: retryMeta.userPrompt },
            context: retryMeta.context,
            requestId,
            classData,
            heroOfTheDay: retryMeta.heroOfTheDay,
            ageTier: retryMeta.ageTier,
            reasonLabels,
            totalStars: retryMeta.totalStars,
            attemptNumber: (Number(resolvedLog.generationAttempts) || 0) + 1,
            allowArtwork: shouldAllowArtwork
        });

        if (!result.superseded) showToast('The Chronicler finished reviewing this entry.', 'success');
    } catch (error) {
        console.error('Manual chronicler retry failed:', error);
        await updateAdventureLogGenerationState(logId, {
            generationStatus: 'failed',
            generationAttempts: (Number(resolvedLog.generationAttempts) || 0) + 1,
            generationError: String(error?.message || 'AI generation failed.'),
            pendingRetryAt: null,
            generationUpdatedAt: serverTimestamp(),
            generationSummary: describeAdventureLogGenerationStatus('failed')
        }, requestId);
        showToast('Retry failed. Please try again later.', 'error');
    }
}

async function finalizeAdventureLogGeneration({
    logId,
    aiPrompts,
    classData,
    heroOfTheDay,
    ageTier,
    reasonLabels,
    totalStars,
    attemptNumber = 1,
    context,
    requestId,
    allowArtwork = true
}) {
    const aiResult = await callGeminiApiDetailed(aiPrompts.systemPrompt, aiPrompts.userPrompt, {
        retries: 1,
        baseDelay: 700,
        // Allow the proxy's 25s primary + 20s OpenRouter + 10s final backup deadlines
        // to finish before starting another attempt.
        timeoutMs: 65000,
        jsonMode: true
    });

    const { parseChroniclerDiary, buildChroniclerPrompts } = await import('../../features/adventureLogContextCore.mjs');
    let finalDiary = parseChroniclerDiary(aiResult.content, context);
    let finalProvider = aiResult.providerId;
    if (!finalDiary) {
        const repair = buildChroniclerPrompts(context, { repairOutput: aiResult.content });
        const repaired = await callGeminiApiDetailed(repair.systemPrompt, repair.userPrompt, { retries: 0, timeoutMs: 65000, jsonMode: true });
        finalDiary = parseChroniclerDiary(repaired.content, context);
        finalProvider = repaired.providerId;
    }
    if (!finalDiary) throw new Error('The Chronicler returned an incomplete diary. The saved lesson will be retried.');
    const applied = await runTransaction(db, async tx => {
        const logRef = doc(db, 'artifacts/great-class-quest/public/data/adventure_logs', logId);
        const snap = await tx.get(logRef);
        if (!snap.exists() || snap.data().generationRequestId !== requestId) return false;
        if (snap.data().createdBy?.uid !== state.get('currentUserId') || snap.data().schoolYearKey !== state.getActiveSchoolYearKey()) return false;
        tx.update(logRef, {
            title: finalDiary.title, text: finalDiary.entry, highlights: finalDiary.highlights,
            keywords: finalDiary.keywords, coveredSections: finalDiary.coveredSections,
            ageTier, totalStars, generationStatus: 'ready', generationProvider: finalProvider || 'unknown',
            generationAttempts: attemptNumber, pendingRetryAt: null, generationError: '',
            generationUpdatedAt: serverTimestamp(), generationSummary: describeAdventureLogGenerationStatus('ready')
        });
        return true;
    });
    if (!applied) return { superseded: true };

    if (allowArtwork) {
        import('../../features/adventureLogArtwork.js').then(m => m.generateAdventureLogArtwork(logId)).catch((error) => {
            console.error('Chronicler artwork generation/upload failed:', error);
        });
    }

    return { diary: finalDiary, aiResult };
}

function scheduleAdventureLogRetry(payload, delayMs, retryIndex) {
    window.setTimeout(async () => {
        try {
            const claimed = await updateAdventureLogGenerationState(payload.logId, {
                generationStatus: 'retrying',
                pendingRetryAt: null,
                generationUpdatedAt: serverTimestamp(),
                generationSummary: describeAdventureLogGenerationStatus('retrying')
            }, payload.requestId);
            if (!claimed) return;

            const result = await finalizeAdventureLogGeneration({
                ...payload,
                attemptNumber: payload.initialAttemptNumber + retryIndex + 1,
                allowArtwork: true
            });

            if (!result.superseded) showToast('The Chronicler finished a pending adventure log.', 'success');
        } catch (error) {
            console.error(`Chronicler retry ${retryIndex + 1} failed:`, error);
            const nextDelay = ADVENTURE_LOG_AI_RETRY_DELAYS_MS[retryIndex + 1];
            if (nextDelay) {
                const pendingUntil = new Date(Date.now() + nextDelay).toISOString();
                const queued = await updateAdventureLogGenerationState(payload.logId, {
                    generationStatus: 'pending',
                    pendingRetryAt: pendingUntil,
                    generationAttempts: payload.initialAttemptNumber + retryIndex + 1,
                    generationError: String(error?.message || 'AI generation is still unavailable.'),
                    generationUpdatedAt: serverTimestamp(),
                    generationSummary: describeAdventureLogGenerationStatus('pending')
                }, payload.requestId);
                if (!queued) return;
                scheduleAdventureLogRetry(payload, nextDelay, retryIndex + 1);
                return;
            }

            await updateAdventureLogGenerationState(payload.logId, {
                generationStatus: 'failed',
                generationAttempts: payload.initialAttemptNumber + retryIndex + 1,
                generationError: String(error?.message || 'AI generation failed.'),
                pendingRetryAt: null,
                generationUpdatedAt: serverTimestamp(),
                generationSummary: describeAdventureLogGenerationStatus('failed')
            }, payload.requestId);
        }
    }, delayMs);
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

        transaction.set(logRef, withSchoolYear(logPayload, state.getActiveSchoolYearKey()));

        if (heroStudentId && scoreRef) {
            const yearContext = getYearLegendContextFromState(state);
            if (scoreDoc?.exists()) {
                const winWrite = nextHeroOfDayWinWrite(scoreDoc.data() || {}, yearContext);
                if (winWrite.increment) {
                    transaction.update(scoreRef, {
                        heroOfDayWins: increment(1),
                        ...(winWrite.heroOfDayWinsYearKey ? { heroOfDayWinsYearKey: winWrite.heroOfDayWinsYearKey } : {})
                    });
                } else {
                    transaction.update(scoreRef, {
                        heroOfDayWins: winWrite.heroOfDayWins,
                        ...(winWrite.heroOfDayWinsYearKey ? { heroOfDayWinsYearKey: winWrite.heroOfDayWinsYearKey } : {})
                    });
                }
            } else {
                transaction.set(scoreRef, withActiveScoreYear({
                    heroOfDayWins: 1,
                    ...(yearContext.activeYearKey ? { heroOfDayWinsYearKey: yearContext.activeYearKey } : {})
                }, state.getActiveSchoolYearKey()), { merge: true });
            }
        }
    });

    return logRef.id;
}

function getPresentStudentsForClass(classId) {
    const attendanceRecords = state.get('allAttendanceRecords').filter(r => r.classId === classId && r.date === getTodayDateString());
    const absentStudentIds = new Set(attendanceRecords.map(r => r.studentId));
    return state.get('allStudents').filter(s => s.classId === classId && s.enrollmentStatus !== 'inactive' && !absentStudentIds.has(s.id));
}

/** Opens the Today's Page chooser straight away when there is no crowning to watch first. */
function openDiaryChooserNow(diaryLogId) {
    if (!diaryLogId) return;
    import('../../ui/modals/diaryChooser.js').then(m => m.openDiaryChooser(diaryLogId)).catch(() => {});
}

async function showHeroOfTheDayReveal(heroStudentId, reasonText = 'The Class Hero!', campfireDetail = null, { diaryLogId = null } = {}) {
    const heroStudent = heroStudentId ? state.get('allStudents').find(s => s.id === heroStudentId) : null;
    if (!heroStudent) {
        if (campfireDetail) window.dispatchEvent(new CustomEvent('gcq:hero-crowned', { detail: campfireDetail }));
        openDiaryChooserNow(diaryLogId);
        return;
    }

    state.setReigningHero(heroStudent);
    import('../../features/home.js').then(m => m.renderHomeTab()).catch(() => {});

    const classId = campfireDetail?.classId || heroStudent.classId;
    const contenders = classId ? getPresentStudentsForClass(classId) : [];

    const [{ showAnimatedModal }, audio, { startHeroOfDayReveal }] = await Promise.all([
        import('../../ui/modals.js'),
        import('../../audio.js'),
        import('../../ui/modals/heroOfDayReveal.js')
    ]);
    audio.ensureAudioReady?.().then(() => audio.primeHeroRevealSound?.()).catch(() => {});
    startHeroOfDayReveal({ hero: heroStudent, contenders, reasonText, audio });
    showAnimatedModal('hero-celebration-modal');
    const modal = document.getElementById('hero-celebration-modal');
    modal._campfireDetail = campfireDetail;
    // Huzzah! (ui/core/listeners.js) opens the Today's Page chooser for this page.
    modal._diaryLogId = diaryLogId;
}

function _getAgeTierFromLeague(league) {
    return getAgeTierForLeague(league);
}

// classRef and classDocPromise are pre-created by the caller so the DB read
// runs in parallel with synchronous data collection, not sequentially before the AI call.
async function _selectHeroOfTheDay(classId, presentStudents, classRef, classDocPromise) {
    if (!presentStudents.length) return { heroName: 'The Class Team', heroStudentId: null };

    const presentIds = presentStudents.map(s => s.id);
    const presentSet = new Set(presentIds);
    const allScores = state.get('allStudentScores');

    const protagonist = presentStudents.find(s => (allScores.find(sc => sc.id === s.id)?.pendingHeroStatus === true));

    // Await the already-in-flight DB read (likely already resolved by now)
    const classDoc = await classDocPromise;
    const freshRotation = classDoc.exists() ? (classDoc.data().heroRotation || {}) : {};

    let cycleHeroIds = Array.isArray(freshRotation.cycleHeroIds)
        ? freshRotation.cycleHeroIds.filter(id => presentSet.has(id))
        : [];
    const lastHeroId = freshRotation.lastHeroId || null;

    const { pickFairRotation } = await import('../../utils/fairRotation.mjs');
    const selection = pickFairRotation({ presentIds, cycleIds: cycleHeroIds, lastIds: lastHeroId ? [lastHeroId] : [], priorityIds: protagonist ? [protagonist.id] : [], count: 1 });
    const chosenId = selection.selectedIds[0];
    cycleHeroIds = selection.cycleIds;
    if (protagonist) {
        // Fire-and-forget: clear the flag — does not need to block the AI call
        const protagonistScoreRef = doc(db, 'artifacts/great-class-quest/public/data/student_scores', protagonist.id);
        updateDoc(protagonistScoreRef, { pendingHeroStatus: false }).catch(e =>
            console.error('Failed to clear pendingHeroStatus:', e));
    }

    if (!cycleHeroIds.includes(chosenId)) cycleHeroIds.push(chosenId);

    const newRotation = {
        cycleHeroIds,
        lastHeroId: chosenId,
        cycleSize: presentIds.length,
        updatedAt: serverTimestamp()
    };

    // Update local state immediately (optimistic)
    const allTeachersClasses = state.get('allTeachersClasses');
    const classIndex = allTeachersClasses.findIndex(c => c.id === classId);
    if (classIndex !== -1) {
        allTeachersClasses[classIndex] = {
            ...allTeachersClasses[classIndex],
            heroRotation: { cycleHeroIds, lastHeroId: chosenId, cycleSize: presentIds.length }
        };
        state.setAllTeachersClasses(allTeachersClasses);
    }

    // Fire-and-forget: persist rotation — runs in parallel with the AI call
    updateDoc(classRef, { heroRotation: newRotation }).catch(e =>
        console.error('Failed to persist hero rotation:', e));

    const student = presentStudents.find(s => s.id === chosenId) || state.get('allStudents').find(s => s.id === chosenId);
    return { heroName: student?.name || 'The Class Team', heroStudentId: student?.id || null };
}


export function handleStarManagerStudentSelect() {
    const studentId = document.getElementById('star-manager-student-select').value;
    const logFormElements = [
        document.getElementById('star-manager-date'),
        document.getElementById('star-manager-stars-to-add'),
        document.getElementById('star-manager-reason'),
        document.getElementById('star-manager-add-btn')
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
        document.getElementById('star-manager-date').value = utils.getLocalIsoDateString();

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
