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

export async function handleLogAdventure() {
    const classId = state.get('currentLogFilter').classId;
    if (!classId) return;
    // Local bank only: this must never queue an AI request in front of the Chronicler.
    import('../../features/campfire/campfireService.js').then(m => m.kindleCampfire(classId)).catch(() => {});

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
    const { buildChroniclerPrompts } = await import('../../features/adventureLogContextCore.mjs');
    let context = log.chroniclerContext;
    if (!context?.version) {
        const { gatherAdventureLogContext } = await import('../../features/adventureLogContext.js');
        context = (await gatherAdventureLogContext(log.classId, { date: log.date, hero: log.hero })).context;
        await updateAdventureLogGenerationState(log.id, { chroniclerContext: context });
    }
    return { ...buildChroniclerPrompts(context, { previousText: options.previousText ?? log.text }), context,
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
    return state.get('allStudents').filter(s => s.classId === classId && !absentStudentIds.has(s.id));
}

async function showHeroOfTheDayReveal(heroStudentId, reasonText = 'The Class Hero!', campfireDetail = null) {
    if (!heroStudentId) {
        if (campfireDetail) window.dispatchEvent(new CustomEvent('gcq:hero-crowned', { detail: campfireDetail }));
        return;
    }

    const heroStudent = state.get('allStudents').find(s => s.id === heroStudentId);
    if (!heroStudent) {
        if (campfireDetail) window.dispatchEvent(new CustomEvent('gcq:hero-crowned', { detail: campfireDetail }));
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
    document.getElementById('hero-celebration-modal')._campfireDetail = campfireDetail;
}

async function handleAILogAdventure(classId, classData) {
    const btn = document.getElementById('log-adventure-btn');
    btn.disabled = true;
    btn.innerHTML = `<i class="fas fa-spinner fa-spin mr-2"></i> Writing History...`;

    import('../../audio.js').then(m => m.playWritingLoop());

    try {
        const { gatherAdventureLogContext } = await import('../../features/adventureLogContext.js');
        const { buildChroniclerPrompts } = await import('../../features/adventureLogContextCore.mjs');
        const lessonDate = getTodayDateString();
        const gathered = await gatherAdventureLogContext(classId, { date: lessonDate });
        classData = gathered.classData;
        const ageTier = _getAgeTierFromLeague(classData.questLevel);
        const todaysAwards = gathered.awards.filter(a => a.classId === classId && utils.datesMatch(a.date, lessonDate));
        const { getAwardLogMonthlyStarCredit, getClassQuestBonusStarsFromAwardLog } = await import('../../features/awardLogReasonMeta.js');
        const totalStars = todaysAwards.reduce((sum, a) => sum + getAwardLogMonthlyStarCredit(a) + getClassQuestBonusStarsFromAwardLog(a), 0);
        const reasonLabels = [...new Set(todaysAwards.filter(a => a.reason !== 'marked_present').map(a => a.reason?.replaceAll('_', ' ')).filter(Boolean))];
        const topReasonsStr = reasonLabels.join(', ') || 'shared effort';
        const absent = new Set(gathered.attendance.filter(a => a.classId === classId && utils.datesMatch(a.date, lessonDate) && a.status !== 'present').map(a => a.studentId));
        const presentStudents = gathered.students.filter(s => s.enrollmentStatus !== 'inactive' && !absent.has(s.id));
        const classRef = doc(db, 'artifacts/great-class-quest/public/data/classes', classId);
        const heroSelection = await _selectHeroOfTheDay(classId, presentStudents, classRef, getDoc(classRef));
        const heroOfTheDay = heroSelection.heroName, heroStudentId = heroSelection.heroStudentId;
        const context = { ...gathered.context, hero: heroOfTheDay };
        const learnedToday = gathered.learnedToday;
        const aiPrompts = buildChroniclerPrompts(context);
        const requestId = crypto.randomUUID();
        const placeholderDiary = buildAdventureLogPlaceholder({
            className: classData.name,
            heroOfTheDay,
            totalStars,
            topReasonsStr,
            reasonLabels,
            early: context.early
        });

        const logId = await saveAdventureLogWithHeroWin({
            classId,
            date: lessonDate,
            title: placeholderDiary.title,
            text: placeholderDiary.entry,
            highlights: placeholderDiary.highlights,
            keywords: placeholderDiary.keywords,
            hero: heroOfTheDay,
            heroStudentId: heroStudentId || null,
            entryMode: 'ai',
            ageTier,
            imageUrl: null,
            topReason: reasonLabels[0] || 'excellence',
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
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
            createdAt: serverTimestamp()
        }, heroStudentId);

        // Stop the writing loop before the hero reveal so the fanfare
        // always plays cleanly on a silent audio context.
        const _audio = await import('../../audio.js');
        _audio.stopWritingLoop();

        await showHeroOfTheDayReveal(heroStudentId, 'The Class Hero!', { classId, logId, studentId: heroStudentId, learnedToday });

        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-feather-alt mr-2"></i> Log Today's Adventure`;

        // Fire-and-forget: AI text + artwork generation runs in the background.
        finalizeAdventureLogGeneration({
            logId,
            aiPrompts,
            context,
            requestId,
            classData,
            heroOfTheDay,
            ageTier,
            reasonLabels,
            totalStars,
            attemptNumber: 1,
            allowArtwork: true
        }).then(result => {
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
                scheduleAdventureLogRetry({
                    logId,
                    aiPrompts,
                    context,
                    requestId,
                    classData,
                    heroOfTheDay,
                    ageTier,
                    reasonLabels,
                    totalStars,
                    initialAttemptNumber: 1
                }, firstRetryDelay, 0);
                showToast('Chronicler AI is busy. The entry is saved and will retry automatically.', 'info');
            } else {
                showToast('Chronicler AI could not finish this entry yet.', 'error');
            }
        });
    } catch (error) {
        console.error('Chronicler log adventure failed:', error);
        showToast('Something went wrong. Please try again.', 'error');
        import('../../audio.js').then(m => m.stopWritingLoop());
        btn.disabled = false;
        btn.innerHTML = `<i class="fas fa-feather-alt mr-2"></i> Log Today's Adventure`;
    }
}

/** Optional, pre-filled "What we learned today" block for the manual log page. */
function buildManualLearnedTodayHtml(learned, learnedModule) {
    const picks = learnedModule.renderLearnedTodayPicksHtml(learned, 'learned');
    const collected = picks
        ? `${picks}<p class="adventure-log-editor-hint">Collected from today's lesson. Untick anything that does not fit.</p>`
        : '<p class="adventure-log-editor-hint">Nothing collected yet today (no quiz, story, quest or trial). You can leave this empty.</p>';
    return `
        <div class="learned-today-box">
            ${collected}
            <input type="text" id="manual-log-learned-extra" maxlength="160" placeholder="Add your own line (optional), e.g. Describing people with adjectives" autocomplete="off">
        </div>`;
}

function closeManualLogEditor() {
    const overlay = document.getElementById('adventure-log-new-modal');
    if (!overlay) return;
    overlay._cleanup?.();
    overlay.remove();
    if (!document.getElementById('adventure-log-editor-modal')) {
        document.body.classList.remove('adventure-log-editor-open');
    }
}

async function handleManualLogAdventure(classId, classData) {
    // Loaded on demand to keep it out of the shared actions chunk.
    const [learnedModule, editor] = await Promise.all([
        import('../../features/learnedToday.js'),
        import('../../features/diaryPageEditor.js')
    ]);
    const learnedToday = await learnedModule.gatherLearnedToday(classId);

    closeManualLogEditor();
    const overlay = document.createElement('div');
    overlay.id = 'adventure-log-new-modal';
    overlay.className = 'adventure-log-editor-overlay adventure-log-editor-overlay--new';
    overlay.innerHTML = editor.diaryPageEditorHtml({
        ids: {
            heading: 'adventure-log-new-title',
            close: 'close-manual-log-btn',
            title: 'manual-log-title',
            counter: 'manual-log-title-counter',
            story: 'manual-log-text',
            highlights: 'manual-log-highlights',
            cancel: 'cancel-manual-log-btn',
            save: 'save-manual-log-btn'
        },
        heading: "Write today's page",
        subtitle: `${editor.escapeDiaryEditorHtml(classData.name || 'Your class')}'s diary`,
        dateLabel: editor.formatDiaryEditorDate(new Date()),
        heroHtml: editor.diaryEditorHeroHtml('', { pending: true }),
        learnedHtml: buildManualLearnedTodayHtml(learnedToday, learnedModule),
        saveLabel: 'Save page & crown the Hero',
        saveIcon: 'fa-crown'
    });
    document.body.appendChild(overlay);
    document.body.classList.add('adventure-log-editor-open');

    const titleInput = overlay.querySelector('#manual-log-title');
    const counter = overlay.querySelector('#manual-log-title-counter');
    const saveBtn = overlay.querySelector('#save-manual-log-btn');
    const updateCounter = () => {
        counter.textContent = `${titleInput.value.length} / 90`;
        counter.classList.toggle('limit', titleInput.value.length > 80);
    };
    const onKey = (event) => {
        if (saveBtn.disabled) return;
        if (event.key === 'Escape') {
            event.preventDefault();
            closeManualLogEditor();
        }
        if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
            event.preventDefault();
            saveBtn.click();
        }
    };
    overlay._cleanup = () => document.removeEventListener('keydown', onKey);
    document.addEventListener('keydown', onKey);
    titleInput.addEventListener('input', updateCounter);
    updateCounter();
    editor.bindDiaryHighlightPreview(overlay.querySelector('#manual-log-highlights'), overlay);

    overlay.addEventListener('click', (event) => {
        if (event.target === overlay && !saveBtn.disabled) closeManualLogEditor();
    });
    overlay.querySelector('#close-manual-log-btn').addEventListener('click', closeManualLogEditor);
    overlay.querySelector('#cancel-manual-log-btn').addEventListener('click', closeManualLogEditor);
    saveBtn.addEventListener('click', async () => await saveManualLogEntry(classId, classData, learnedModule.readLearnedTodayPicks(overlay, learnedToday, 'learned', '#manual-log-learned-extra')));
    requestAnimationFrame(() => titleInput.focus());
}

async function saveManualLogEntry(classId, classData, learnedToday = null) {
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
    saveBtn.innerHTML = `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>Crowning the Hero…</span>`;

    try {
        const highlights = highlightsText ? highlightsText.split(',').map(h => h.trim()).filter(h => h) : [];
        const todaysAwards = state.get('allAwardLogs').filter(log => log.classId === classId && log.date === getTodayDateString());
        const presentStudents = getPresentStudentsForClass(classId);
        const _manualClassRef = doc(db, 'artifacts/great-class-quest/public/data/classes', classId);
        const heroSelection = await _selectHeroOfTheDay(classId, presentStudents, _manualClassRef, getDoc(_manualClassRef));
        const storyText = syncHeroLine(text, heroSelection.heroName);
        const keywords = buildAdventureLogKeywords(storyText);
        
        const logId = await saveAdventureLogWithHeroWin({
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
            learnedToday: learnedToday || { items: [], words: [], summary: '' },
            createdBy: { uid: state.get('currentUserId'), name: state.get('currentTeacherName') },
            createdAt: serverTimestamp()
        }, heroSelection.heroStudentId);
        
        closeManualLogEditor();
        showToast('Your adventure has been recorded!', 'success');

        await showHeroOfTheDayReveal(heroSelection.heroStudentId, 'Crowned in today\'s chronicle!', { classId, logId, studentId: heroSelection.heroStudentId, learnedToday });
    } catch (error) {
        console.error("Error saving manual log:", error);
        showToast('Failed to save your entry. Please try again.', 'error');
    } finally {
        logBtn.disabled = false;
        logBtn.innerHTML = `<i class="fas fa-feather-alt mr-2"></i> Log Today's Adventure`;
        if (saveBtn && document.body.contains(saveBtn)) {
            saveBtn.disabled = false;
            saveBtn.innerHTML = `<i class="fas fa-crown" aria-hidden="true"></i><span>Save page &amp; crown the Hero</span>`;
        }
    }
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
