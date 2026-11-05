// /db/actions/stars.js — scores, stars, award log
import { quietly } from '../../utils/runtimeMetrics.js';
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
    deleteField,
    orderBy,
    limit,
} from "../../firebase.js";
import {
    shouldSkipPostCloseHeroReconcile,
    yearScopeClauses,
} from "../../utils/schoolYear.js";
import { getLiveYearGold, getLiveYearGoldContextFromState } from "../../utils/yearGold.js";
import * as state from "../../state.js";
import { showToast, showPraiseToast } from "../../ui/effects.js";
import {
    showStarfallModal,
    showBatchStarfallModal,
    hideModal,
} from "../../ui/modals/index.js";
import { playSound } from "../../audio.js";
import {
    getTodayDateString,
    getStartOfMonthString,
    debounce,
    parseDDMMYYYY,
    datesMatch,
    getClassMonthlyQuestStars,
    calculateMonthlyClassGoal,
    getMonthKey,
} from "../../utils.js";
import { checkBountyProgress } from "./bounties.js";
import {
    calculateHeroGold,
    canChangeHeroClass,
    summarizePatronPathFromLogDates,
} from "../../features/heroClasses.js";
import { recordGuildGloryEvent, updateGuildScores } from "../../features/guildScoring.js";
import {
    computeHeroLevel,
    getHeroReason,
    getHeroReasons,
    getOutwardEffects,
    heroClassEarnsFrom,
} from "../../features/heroSkillTree.js";
import { TRAINING_REASONS } from "../../features/trainingGroundsCore.mjs";
import { reconcileFamiliarLifecycle } from "../../features/familiars.js";
import { canUseFeature } from "../../utils/subscription.js";
import { getAwardLogMonthlyStarCredit, isBonusOnlyAwardLog, isStarManagerAwardLog } from "../../features/awardLogReasonMeta.js";
import { withActiveScoreYear, withSchoolYear } from "../../utils/schoolYear.js";
import { resolveDailyModifier, applyDailyModifier } from "../../features/specialQuestEngine.js";
import { TRAINING_HERO, normalizeHeroClass } from "../../features/heroClassNames.mjs";
import { runAwardWriteInOrder, withWriteRetries } from "../../features/awardPending.mjs";
import { PUBLIC_DATA_PATH } from '../../utils/tenant.mjs';
import { monthlyStarsChange, rollMonthlyStars } from "./monthlyStars.js";
import { classPortalStatus, completedThisMonth as portalCompletedThisMonth } from "../../features/questPortal.js";

// --- SCORE, STAR, & LOG ACTIONS ---

/** Deterministic id for a teacher's daily star row for one student. */
export function getTodayStarsDocId(teacherId, studentId, date) {
    return `${teacherId}_${studentId}_${date}`;
}

/** Deterministic id for a teacher's daily performance award_log row. */
export function getDailyAwardLogDocId(teacherId, studentId, date) {
    return `daily_${teacherId}_${studentId}_${date}`;
}

/**
 * Sets a student's stars for today from this teacher. One student's writes run one after
 * another, so an undo tapped while an award is still saving can't skip past it.
 * Resolves to today's saved { stars, reason }, or false when the save failed (the teacher is told).
 */
export function setStudentStarsForToday(studentId, starValue, reason = null) {
    return runAwardWriteInOrder(studentId, () => writeStudentStarsForToday(studentId, starValue, reason));
}

async function writeStudentStarsForToday(
    studentId,
    starValue,
    reason = null,
) {
    const awardStartedAt = Date.now();
    const today = getTodayDateString();
    const publicDataPath = PUBLIC_DATA_PATH;
    const activeYearKey = state.getActiveSchoolYearKey();

    // Date-bound maintenance happens only when the teacher performs the first
    // relevant write. Listener hydration, login and navigation stay write-free.
    const scoreBeforeAward = state.get("allStudentScores").find((entry) => entry.id === studentId);
    const currentMonthStart = getStartOfMonthString();
    const maintenanceTasks = [];
    if (scoreBeforeAward?.lastMonthlyResetDate !== currentMonthStart) {
        maintenanceTasks.push(
            import("./economy.js").then(({ checkAndResetMonthlyStars }) =>
                checkAndResetMonthlyStars(studentId, currentMonthStart),
            ),
        );
    }
    await Promise.all(maintenanceTasks);

    let finalStarValue = starValue;
    const studentForModifier = state.get("allStudents").find((student) => student.id === studentId);
    const activeEvents = state.get("allQuestEvents").filter((event) =>
        datesMatch(event.dateKey || event.date, today) &&
        (!event.classId || !studentForModifier?.classId || event.classId === studentForModifier.classId)
    );
    // Special Quests never stack into an ordinary award. Standard modifiers are
    // resolved once per class/day with deterministic 2x precedence.
    const modifier = resolveDailyModifier(activeEvents);
    finalStarValue = applyDailyModifier(finalStarValue, reason, modifier);

    // Audio: the award moment itself (ui/awardFx.js) plays the star sounds in time with the
    // effects, before this write starts; here only a quiet confirm for a present mark.
    if (reason === "marked_present") {
        playSound("confirm");
    }

    let studentClassId = null;
    let difference = 0;
    let guildStarCredit = 0;
    // The day's award row: its id, the stars it credited and the Glory those earned, so a
    // star taken back removes exactly the Glory it gave.
    let dailyLogIdForGlory = null;
    let priorLogCredit = 0;
    let priorLogGlory = null;
    const heroProgressionEnabled = canUseFeature("heroProgression");
    /** Set when a hero level-up occurs in the transaction; used after commit to show celebration modal. */
    let levelUpInfo = null;

    // HERO'S BOON LOGIC

    try {
        let isHeroBoonEligible = false;
        let heroBoonNote = "";
        const reigningHero = state.get("reigningHero");
        // The Hero's Boon (+1) goes with the hero's first stars of the day. Whether stars
        // were already given is read inside the transaction, not from local state that
        // may not have caught up with a save still in flight.
        const heroBoonCandidate = Boolean(reigningHero && reigningHero.id === studentId && starValue > 0);

        const currentTeacherId = state.get("currentUserId");
        // Values below are mutated inside the transaction (Elixir of Luck etc.),
        // so each retry must start again from the pre-transaction values.
        const baseFinalStarValue = finalStarValue;
        const todayStarsRef = doc(
            db,
            `${publicDataPath}/today_stars`,
            getTodayStarsDocId(currentTeacherId, studentId, today),
        );
        const dailyAwardLogRef = doc(
            db,
            `${publicDataPath}/award_log`,
            getDailyAwardLogDocId(currentTeacherId, studentId, today),
        );

        // Firestore already retries contention a few times; a busy lesson with several
        // teachers awarding at once (or a wobbly classroom connection) gets a couple more
        // tries before the teacher is asked to try again.
        await withWriteRetries(() => runTransaction(db, async (transaction) => {
            /** Actual star delta applied to totalStars/monthlyStars for the daily performance log row (includes skill bonuses). */
            let appliedCreditForDailyLog = null;
            finalStarValue = baseFinalStarValue;
            isHeroBoonEligible = false;
            heroBoonNote = "";
            difference = 0;
            guildStarCredit = 0;
            dailyLogIdForGlory = null;
            priorLogCredit = 0;
            priorLogGlory = null;
            studentClassId = null;
            levelUpInfo = null;

            const studentRef = doc(db, `${publicDataPath}/students`, studentId);
            const scoreRef = doc(
                db,
                `${publicDataPath}/student_scores`,
                studentId,
            );

            // All reads happen before any write. The daily record uses a
            // deterministic id so two concurrent awards contend on the same
            // document and Firestore retries the loser instead of creating a
            // duplicate row (and double-crediting stars/gold).
            let todayDocRef = null;
            let oldStars = 0;
            const deterministicTodaySnap = await transaction.get(todayStarsRef);
            if (deterministicTodaySnap.exists()) {
                todayDocRef = todayStarsRef;
                oldStars = deterministicTodaySnap.data().stars || 0;
            } else {
                // Legacy/random-id rows (e.g. Welcome Back unlock rows).
                const todayStarsQuery = query(
                    collection(db, `${publicDataPath}/today_stars`),
                    where("studentId", "==", studentId),
                    where("teacherId", "==", currentTeacherId),
                    where("date", "==", today),
                );
                const todayStarsSnapshot = await getDocs(todayStarsQuery);
                if (!todayStarsSnapshot.empty) {
                    const legacyRef = todayStarsSnapshot.docs[0].ref;
                    const legacySnap = await transaction.get(legacyRef);
                    if (legacySnap.exists()) {
                        todayDocRef = legacyRef;
                        oldStars = legacySnap.data().stars || 0;
                    }
                }
            }
            const dailyAwardLogSnap = await transaction.get(dailyAwardLogRef);

            if (heroBoonCandidate && !(oldStars > 0)) {
                isHeroBoonEligible = true;
                finalStarValue += 1; // Add the bonus star to the total
                heroBoonNote = "🛡️ Includes Hero's Boon (+1 Bonus Star)";
            }

            difference = finalStarValue - oldStars;

            if (difference === 0 && finalStarValue > 0) {
                const logId = state.get("todaysAwardLogs")[studentId];
                if (logId) {
                    const logRef = doc(
                        db,
                        `${publicDataPath}/award_log`,
                        logId,
                    );
                    transaction.update(logRef, { reason });
                }
                return;
            }

            if (difference === 0 && reason !== "marked_present" && !todayDocRef)
                return;

            const studentDoc = await transaction.get(studentRef);
            if (!studentDoc.exists()) throw new Error("Student not found!");
            const studentData = studentDoc.data();
            studentClassId = studentData.classId;

            const scoreDoc = await transaction.get(scoreRef);

            if (!scoreDoc.exists()) {
                // Create new score doc
                transaction.set(scoreRef, withActiveScoreYear({
                    totalStars: difference > 0 ? difference : 0,
                    monthlyStars: difference > 0 ? difference : 0,
                    gold: difference > 0 ? difference : 0,
                    inventory: [],
                    lastMonthlyResetDate: getStartOfMonthString(),
                    createdBy: {
                        uid: studentData.createdBy.uid,
                        name: studentData.createdBy.name,
                    },
                }, activeYearKey));
                if (difference !== 0) {
                    appliedCreditForDailyLog = difference;
                    guildStarCredit = appliedCreditForDailyLog;
                }
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

                // POWER UP: Elixir of Luck (50% chance for +1 Star)
                // We check if luckDate matches TODAY and if we haven't already applied a luck bonus this transaction
                if (
                    currentData.luckDate === today &&
                    difference > 0 &&
                    !isHeroBoonEligible
                ) {
                    // Simple deterministic check based on time to avoid random in transaction re-runs?
                    // No, simpler: Just do it. If transaction retries, it might re-roll, which is acceptable.
                    if (Math.random() < 0.5) {
                        finalStarValue += 1; // Add actual star
                        difference += 1; // Update diff
                        // We consume the date so it doesn't trigger again today
                        transaction.update(scoreRef, { luckDate: null });
                    } else {
                        // Consumed without luck (User tried and failed)
                        transaction.update(scoreRef, { luckDate: null });
                    }
                }

                const safeCurrentGold = getLiveYearGold(
                    currentData,
                    getLiveYearGoldContextFromState(state),
                );

                // Calculate Gold + Skill Bonuses
                const { goldChange, bonusStars } = heroProgressionEnabled
                    ? calculateHeroGold(
                          studentData,
                          reason,
                          difference,
                          currentData,
                      )
                    : { goldChange: difference, bonusStars: 0 };
                const totalGoldChange = goldChange * multiplier;
                const totalDifference = difference + bonusStars;

                if (difference !== 0) {
                    appliedCreditForDailyLog = totalDifference;
                    guildStarCredit = appliedCreditForDailyLog;
                    // --- Track starsByReason for hero skill tree ---
                    const heroClass = studentData.heroClass;
                    const classReason = getHeroReason(heroClass);
                    const updates = {
                        totalStars: increment(totalDifference),
                        // The month is normally rolled over before this transaction; this
                        // covers a reset that failed or raced.
                        ...monthlyStarsChange(transaction, studentId, currentData, totalDifference),
                        gold: Math.max(0, safeCurrentGold + totalGoldChange),
                    };
                    if (
                        heroProgressionEnabled &&
                        heroClass &&
                        classReason &&
                        heroClassEarnsFrom(heroClass, reason) &&
                        difference > 0
                    ) {
                        const currentReasonStars =
                            currentData.starsByReason?.[classReason] || 0;
                        const newReasonStars = currentReasonStars + difference;
                        updates[`starsByReason.${classReason}`] =
                            newReasonStars;

                        // Level-up check
                        const currentHeroLevel = currentData.heroLevel || 0;
                        const newHeroLevel = computeHeroLevel(
                            heroClass,
                            newReasonStars,
                        );
                        if (newHeroLevel > currentHeroLevel) {
                            updates.heroLevel = newHeroLevel;
                            updates.pendingSkillChoice = true;
                            levelUpInfo = {
                                studentId,
                                studentName: studentData.name,
                                newHeroLevel,
                                heroClass,
                            };
                        }
                    }
                    transaction.update(scoreRef, updates);
                }
            }

            // --- Daily Record Logic (Runs for everyone) ---
            if (todayDocRef) {
                if (finalStarValue === 0 && reason !== "marked_present") {
                    transaction.delete(todayDocRef);
                } else {
                    transaction.update(todayDocRef, {
                        stars: finalStarValue,
                        reason: reason,
                    });
                }
            } else {
                if (finalStarValue > 0 || reason === "marked_present") {
                    transaction.set(todayStarsRef, withSchoolYear({
                        studentId,
                        stars: finalStarValue,
                        date: today,
                        reason: reason,
                        teacherId: state.get("currentUserId"),
                        createdBy: {
                            uid: state.get("currentUserId"),
                            name: state.get("currentTeacherName"),
                        },
                    }, activeYearKey));
                }
            }

            // FIX: Find the SPECIFIC log for "standard" daily stars, ignore bonuses
            // Only this teacher's own rows can be updated under the rules.
            const allTodaysLogs = state
                .get("allAwardLogs")
                .filter(
                    (l) =>
                        l.studentId === studentId &&
                        l.date === today &&
                        (l.createdBy?.uid || l.teacherId) === currentTeacherId,
                );
            // Bonus-only rows (Showdown, Quiz of the Week, Quiet Dragon) are never the day's row:
            // updating one would rewrite that bonus as today's stars.
            const stateDailyPerformanceLog = allTodaysLogs.find(
                (l) =>
                    !isBonusOnlyAwardLog(l) &&
                    !isStarManagerAwardLog(l) &&
                    ![
                        "welcome_back",
                        "scholar_s_bonus",
                        "peer_boon",
                        ...TRAINING_REASONS,
                    ].includes(l.reason),
            );
            // Prefer the transactionally-read deterministic row: local state can
            // lag behind a concurrent award that already created it.
            const dailyPerformanceLog = dailyAwardLogSnap.exists()
                ? { id: dailyAwardLogRef.id, ...dailyAwardLogSnap.data() }
                : stateDailyPerformanceLog;
            if (dailyPerformanceLog) {
                priorLogCredit = getAwardLogMonthlyStarCredit(dailyPerformanceLog);
                const loggedGlory = Number(dailyPerformanceLog.guildGlory);
                priorLogGlory = Number.isFinite(loggedGlory) ? loggedGlory : null;
            }
            // The row keeps the day's total credit (not just this change), so deleting it
            // later takes back exactly what the day gave.
            const cumulativeCredit = appliedCreditForDailyLog != null
                ? (dailyPerformanceLog ? priorLogCredit : 0) + appliedCreditForDailyLog
                : null;

            if (finalStarValue === 0) {
                if (dailyPerformanceLog)
                    transaction.delete(
                        doc(
                            db,
                            `${publicDataPath}/award_log`,
                            dailyPerformanceLog.id,
                        ),
                    );
            } else if (finalStarValue > 0) {
                const logData = withSchoolYear({
                    studentId,
                    classId: studentData.classId,
                    teacherId: state.get("currentUserId"),
                    stars: finalStarValue,
                    ...(cumulativeCredit != null
                        ? { appliedStarCredit: cumulativeCredit }
                        : {}),
                    reason: reason || "excellence",
                    note: heroBoonNote || "",
                    date: today,
                    createdAt: serverTimestamp(),
                    createdBy: {
                        uid: state.get("currentUserId"),
                        name: state.get("currentTeacherName"),
                    },
                }, activeYearKey);

                if (dailyPerformanceLog) {
                    transaction.update(
                        doc(
                            db,
                            `${publicDataPath}/award_log`,
                            dailyPerformanceLog.id,
                        ),
                        {
                            stars: finalStarValue,
                            ...(cumulativeCredit != null
                                ? {
                                      appliedStarCredit:
                                          cumulativeCredit,
                                  }
                                : {}),
                            reason: reason || dailyPerformanceLog.reason,
                        },
                    );
                } else {
                    transaction.set(dailyAwardLogRef, logData);
                }
                dailyLogIdForGlory = dailyPerformanceLog ? dailyPerformanceLog.id : dailyAwardLogRef.id;
            }
        }));

        if (isHeroBoonEligible) {
            const student = state
                .get("allStudents")
                .find((s) => s.id === studentId);
            // The crown waits for the star burst of the award itself to settle first.
            const sinceTap = Date.now() - awardStartedAt;
            setTimeout(() => {
                import("../../ui/awardMoments.js")
                    .then((m) => m.playHeroBonusMoment({
                        studentId,
                        name: student?.name || "Hero",
                        avatar: student?.avatar || "",
                    }))
                    .catch((e) => console.warn("Hero bonus moment failed:", e));
            }, Math.max(200, 1150 - sinceTap));
        }

        // Clearing yesterday's scratch rows waits until today's stars are safely saved.
        // It lives in its own small chunk: on a tab left open over a deploy that chunk can be
        // gone, and the stale-build recovery may reload the page, which must never take an
        // award still in flight with it (Bunnies, 03-11-2026: archives saved, awards lost).
        import("../maintenance.js")
            .then(({ cleanupPreviousDayStarsOnce }) =>
                cleanupPreviousDayStarsOnce(state.get("currentUserId"), today),
            )
            .catch((error) => console.warn("Daily scratch cleanup deferred:", error));

        // --- Side Effects (After Transaction) ---
        if (studentClassId && difference > 0) {
            debouncedCheckAndRecordQuestCompletion(studentClassId);
            checkBountyProgress(studentClassId, difference, [studentId]);
            const logIdForGlory = dailyLogIdForGlory;
            updateGuildScores(studentId, guildStarCredit || difference, 'standard_star_award')
                .then((event) => _noteDailyLogGlory(logIdForGlory, event?.totalGloryDelta))
                .catch((e) => console.warn("Guild Glory award failed:", e));
            // Apply outward skill effects (guildmate/classmate gold) — fire-and-forget
            _applyOutwardSkillEffects(
                studentId,
                studentClassId,
                reason,
                difference,
            ).catch((e) => console.warn("Outward skill effect failed:", e));
            // Check familiar hatch / level-up — fire-and-forget
            reconcileFamiliarLifecycle(studentId, {
                announce: true,
                source: "stars",
            }).catch((e) => console.warn("Familiar check failed:", e));
        } else if (studentClassId && difference < 0) {
            const student = (state.get("allStudents") || []).find((s) => s.id === studentId);
            if (student?.guildId) {
                const credit = guildStarCredit || difference;
                // Take back exactly the Glory these stars earned (a star given on a 2x day
                // returns 4, not 2). Rows from before this was tracked use the plain rate.
                const exactGlory = priorLogGlory != null && priorLogCredit > 0
                    ? -Math.round(priorLogGlory * Math.min(1, -credit / priorLogCredit) * 100) / 100
                    : null;
                const logIdForGlory = finalStarValue > 0 ? dailyLogIdForGlory : null;
                recordGuildGloryEvent({
                    guildId: student.guildId,
                    studentId,
                    classId: studentClassId,
                    source: 'standard_star_award_adjustment',
                    starDelta: credit,
                    exactGlory,
                    note: 'Daily award was reduced',
                })
                    .then((event) => _noteDailyLogGlory(logIdForGlory, event?.totalGloryDelta))
                    .catch((e) => console.warn("Guild Glory reduction failed:", e));
            }
        }

        // --- Hero Level-Up Celebration (after successful transaction) ---
        if (levelUpInfo) {
            showHeroLevelUpCelebration(levelUpInfo);
        }
        // What today's row now says, so the cloud can show the real result straight away.
        return {
            stars: finalStarValue,
            reason: finalStarValue > 0 || reason === "marked_present" ? reason : null,
        };
    } catch (error) {
        console.error("Star update transaction failed:", error);
        const name = (state.get("allStudents") || []).find((s) => s.id === studentId)?.name;
        showToast(name
            ? `${name}'s stars didn't save. Please try again.`
            : "Error saving stars! Please try again.", "error");
        return false;
    }
}

export function applyReasonAwardScoreTransaction(
    transaction,
    {
        scoreRef,
        studentId,
        studentData,
        scoreData = null,
        reason,
        awardedStars,
    },
) {
    const heroProgressionEnabled = canUseFeature("heroProgression");
    const currentTotalStars = Number(scoreData?.totalStars) || 0;
    // Starts from this month's count: a counter still holding last month is filed first.
    const { base: currentMonthlyStars, fields: monthStamp } = scoreData
        ? rollMonthlyStars(transaction, studentId, scoreData)
        : { base: 0, fields: {} };
    const safeCurrentGold = getLiveYearGold(
        scoreData,
        getLiveYearGoldContextFromState(state),
    );
    const currentStarsByReason = scoreData?.starsByReason || {};
    const currentHeroLevel = scoreData?.heroLevel || 0;

    const { goldChange, bonusStars } = heroProgressionEnabled
        ? calculateHeroGold(studentData, reason, awardedStars, scoreData)
        : { goldChange: awardedStars, bonusStars: 0 };

    const totalStarsDelta = awardedStars + bonusStars;
    const nextScoreData = {
        ...monthStamp,
        totalStars: currentTotalStars + totalStarsDelta,
        monthlyStars: currentMonthlyStars + totalStarsDelta,
        gold: safeCurrentGold + goldChange,
    };

    let levelUpInfo = null;
    const heroClass = studentData?.heroClass;
    const classReason = getHeroReason(heroClass);

    if (
        heroProgressionEnabled &&
        heroClass &&
        classReason &&
        heroClassEarnsFrom(heroClass, reason) &&
        awardedStars > 0
    ) {
        const newReasonStars =
            (currentStarsByReason[classReason] || 0) + awardedStars;
        nextScoreData.starsByReason = {
            ...currentStarsByReason,
            [classReason]: newReasonStars,
        };

        const newHeroLevel = computeHeroLevel(heroClass, newReasonStars);
        nextScoreData.heroLevel = newHeroLevel;

        if (newHeroLevel > currentHeroLevel) {
            nextScoreData.pendingSkillChoice = true;
            levelUpInfo = {
                studentId,
                studentName: studentData.name,
                newHeroLevel,
                heroClass,
            };
        }
    }

    if (scoreData) {
        transaction.update(scoreRef, nextScoreData);
    } else {
        transaction.set(scoreRef, withActiveScoreYear({
            inventory: [],
            starsByReason: {},
            heroLevel: 0,
            heroSkills: [],
            pendingSkillChoice: false,
            lastMonthlyResetDate: getStartOfMonthString(),
            createdBy: {
                uid: studentData?.createdBy?.uid || state.get("currentUserId"),
                name:
                    studentData?.createdBy?.name ||
                    state.get("currentTeacherName"),
            },
            ...nextScoreData,
        }, state.getActiveSchoolYearKey()));
    }

    return { levelUpInfo, totalStarsDelta };
}

export function showHeroLevelUpCelebration(levelUpInfo) {
    if (!levelUpInfo) return;
    import("../../ui/modals/heroLevelUp.js").then((m) =>
        m.showHeroLevelUpCelebration(levelUpInfo),
    );
}

export function applyAwardOutwardSkillEffects(
    studentId,
    classId,
    reason,
    awardedStars,
    options = {},
) {
    if (!studentId || !classId || !reason || awardedStars <= 0)
        return Promise.resolve();
    return _applyOutwardSkillEffects(studentId, classId, reason, awardedStars, options);
}

export async function reconcileScholarAndNomadProgressFromLogs() {
    if (!canUseFeature("heroProgression")) return;
    if (shouldSkipPostCloseHeroReconcile(state.get("schoolYearState"))) return;

    const targetStudents = state
        .get("allStudents")
        .filter((student) => ["Scholar", "Nomad", "Patron", TRAINING_HERO].includes(normalizeHeroClass(student.heroClass)));
    if (targetStudents.length === 0) return;

    const publicDataPath = PUBLIC_DATA_PATH;
    const schoolYearState = state.get("schoolYearState") || {};
    const enforceActiveYearQueries =
        schoolYearState.enforceActiveYearQueries === true;
    const activeYearKey = state.getActiveSchoolYearKey();
    const scoresById = new Map(
        state.get("allStudentScores").map((score) => [score.id, score]),
    );
    const batch = writeBatch(db);
    let hasUpdates = false;

    for (const student of targetStudents) {
        const scoreData = scoresById.get(student.id);
        if (!scoreData) continue;

        const reason = getHeroReason(student.heroClass);
        if (!reason) continue;

        const isPatronGiverPath = student.heroClass === "Patron";
        const logsSnapshot = await getDocs(
            query(
                collection(db, `${publicDataPath}/award_log`),
                where(isPatronGiverPath ? "giverId" : "studentId", "==", student.id),
                // The Vanguard's path sums every Training Grounds reason.
                normalizeHeroClass(student.heroClass) === TRAINING_HERO
                    ? where("reason", "in", getHeroReasons(student.heroClass))
                    : where("reason", "==", reason),
                ...yearScopeClauses(
                    enforceActiveYearQueries,
                    activeYearKey,
                ),
            ),
        );

        let reasonStars;
        let patronWeekPatch = null;
        if (isPatronGiverPath) {
            const summary = summarizePatronPathFromLogDates(
                logsSnapshot.docs.map((logDoc) => logDoc.data().date),
            );
            reasonStars = summary.reasonStars;
            const currentStamp = String(scoreData.lastPatronPathCreditWeekKey || "");
            if (summary.giftedThisWeek && currentStamp !== summary.thisWeekKey) {
                patronWeekPatch = { lastPatronPathCreditWeekKey: summary.thisWeekKey };
            } else if (!summary.giftedThisWeek && currentStamp === summary.thisWeekKey) {
                patronWeekPatch = { lastPatronPathCreditWeekKey: deleteField() };
            }
        } else {
            reasonStars = logsSnapshot.docs.reduce(
                (total, logDoc) => total + (Number(logDoc.data().stars) || 0),
                0,
            );
        }
        const expectedLevel = computeHeroLevel(student.heroClass, reasonStars);
        const currentReasonStars = scoreData.starsByReason?.[reason] || 0;
        const currentLevel = scoreData.heroLevel || 0;

        if (
            Math.abs(currentReasonStars - reasonStars) < 0.0001 &&
            currentLevel === expectedLevel &&
            !patronWeekPatch
        )
            continue;

        const scoreRef = doc(
            db,
            `${publicDataPath}/student_scores`,
            student.id,
        );
        const scorePatch = {
            [`starsByReason.${reason}`]: reasonStars,
            heroLevel: expectedLevel,
            ...patronWeekPatch,
        };

        if (expectedLevel > currentLevel) {
            scorePatch.pendingSkillChoice = true;
        }

        batch.update(scoreRef, scorePatch);
        hasUpdates = true;
    }

    if (hasUpdates) {
        await batch.commit();
    }
}

/**
 * Opens the Portal for a class once its stars fill this month's goal AND every Portal rune of
 * its rank is lit (features/questRanksCore.mjs). The goal itself is calculated exactly as
 * before. Stepping through raises the quest level, keeps a quest_history record and pays the
 * Portal spoils (Gold for every hero), all in one transaction so it happens once.
 * When the stars are there but a rune still sleeps (or the Guardian waits), the teacher is
 * told once per session and nothing is recorded yet.
 */
export async function checkAndRecordQuestCompletion(classId) {
    const classRef = doc(
        db,
        `${PUBLIC_DATA_PATH}/classes`,
        classId,
    );
    const classDoc = await getDoc(classRef);
    if (!classDoc.exists()) return;
    const classData = { id: classId, ...classDoc.data() };

    // Already through this month: nothing to do (no repeated popups).
    if (portalCompletedThisMonth(classData)) return;

    const studentsInClass = state
        .get("allStudents")
        .filter((s) => s.classId === classId);
    if (studentsInClass.length === 0) return;

    const status = classPortalStatus(classData, { students: studentsInClass });
    if (!status?.starsMet) return;
    if (!status.readyToRecord) {
        import("../../features/portalMoments.js")
            .then(({ announcePortalWaiting }) => announcePortalWaiting(classData, status))
            .catch(quietly('db/actions/stars.js'));
        return;
    }

    let crossing;
    try {
        crossing = await recordPortalCrossing(classData, studentsInClass, status);
    } catch (error) {
        // A hero's score this teacher may not write must never keep the class from stepping
        // through: record the crossing without the Gold.
        if (error?.code !== "permission-denied") throw error;
        crossing = await recordPortalCrossing(classData, studentsInClass, status, { payGold: false });
    }
    if (!crossing) return;
    import("../../features/portalMoments.js")
        .then(({ announcePortalCrossing }) => announcePortalCrossing(classData, crossing, status))
        .catch(quietly('db/actions/stars.js'));
}

async function recordPortalCrossing(classData, studentsInClass, status, { payGold = true } = {}) {
    const classRef = doc(db, `${PUBLIC_DATA_PATH}/classes`, classData.id);
    const monthKey = getMonthKey();
    const goldContext = getLiveYearGoldContextFromState(state);
    const gold = payGold ? status.spoils : 0;
    return runTransaction(db, async (transaction) => {
        const snap = await transaction.get(classRef);
        if (!snap.exists()) return null;
        const fresh = { id: classData.id, ...snap.data() };
        if (portalCompletedThisMonth(fresh)) return null;
        const currentDifficulty = Number(fresh.difficultyLevel) || 0;
        const reads = gold > 0 ? await Promise.all(studentsInClass.map(async (s) => {
            const ref = doc(db, `${PUBLIC_DATA_PATH}/student_scores`, s.id);
            return { ref, snap: await transaction.get(ref) };
        })) : [];

        // A. The class steps through and rises one level.
        transaction.update(classRef, {
            questCompletedAt: serverTimestamp(),
            difficultyLevel: increment(1),
            [`portalCrossings.${monthKey}`]: {
                level: status.level,
                rank: status.rank.id,
                gold,
                stars: status.totalStars,
                goal: status.goal,
                runes: status.runes.map((r) => r.id),
            },
        });

        // B. Persistent history record.
        const historyRef = doc(collection(db, `${PUBLIC_DATA_PATH}/quest_history`));
        transaction.set(historyRef, withSchoolYear({
            classId: classData.id,
            className: fresh.name,
            levelReached: currentDifficulty + 1, // They just finished currentDifficulty to reach +1
            goalTarget: status.goal,
            starsEarned: status.totalStars,
            runes: status.runes.map((r) => r.id),
            spoilsGold: gold,
            completedAt: serverTimestamp(),
            monthKey, // "2026-01" (local month)
            createdBy: {
                uid: state.get("currentUserId"),
                name: state.get("currentTeacherName"),
            },
        }, state.getActiveSchoolYearKey()));

        // C. Portal spoils: Gold for every hero.
        let heroes = 0;
        reads.forEach(({ ref, snap: scoreSnap }) => {
            if (!scoreSnap.exists() || gold <= 0) return;
            heroes += 1;
            transaction.update(ref, { gold: getLiveYearGold(scoreSnap.data(), goldContext) + gold });
        });
        return {
            fromLevel: status.level,
            toLevel: currentDifficulty + 2,
            gold,
            heroes,
        };
    });
}

/** Adds the Glory an award (or its reduction) wrote to the day's award row. */
function _noteDailyLogGlory(logId, gloryDelta) {
    const amount = Number(gloryDelta);
    if (!logId || !Number.isFinite(amount) || amount === 0) return;
    updateDoc(doc(db, `${PUBLIC_DATA_PATH}/award_log`, logId), {
        guildGlory: increment(amount),
    }).catch(() => { /* the row may have been removed meanwhile */ });
}

const debouncedCheckAndRecordQuestCompletion = debounce(
    checkAndRecordQuestCompletion,
    4000,
);

export async function handleDeleteAwardLog(logId) {
    const publicDataPath = PUBLIC_DATA_PATH;
    let deletedGuildEvent = null;
    let deletedLogMonthKey = null;
    try {
        await runTransaction(db, async (transaction) => {
            deletedLogMonthKey = null;
            const logRef = doc(db, `${publicDataPath}/award_log`, logId);

            const logDoc = await transaction.get(logRef);
            if (!logDoc.exists()) {
                return;
            }
            const logData = logDoc.data();
            const starCredit = getAwardLogMonthlyStarCredit({
                ...logData,
                id: logId,
            });
            const studentId = logData.studentId;
            const student = (state.get("allStudents") || []).find((s) => s.id === studentId);
            if (student?.guildId && starCredit) {
                const loggedGlory = Number(logData.guildGlory);
                deletedGuildEvent = {
                    guildId: student.guildId,
                    studentId,
                    classId: logData.classId || student.classId || null,
                    starCredit,
                    guildGlory: Number.isFinite(loggedGlory) ? loggedGlory : null,
                    reason: logData.reason || 'award_log',
                };
            }

            const scoreRef = doc(
                db,
                `${publicDataPath}/student_scores`,
                studentId,
            );
            const scoreDoc = await transaction.get(scoreRef);
            const logDate = parseDDMMYYYY(logData.date);
            const today = new Date();
            const isCurrentMonth =
                logDate.getMonth() === today.getMonth() &&
                logDate.getFullYear() === today.getFullYear();
            deletedLogMonthKey = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, "0")}`;
            // A finished month was archived at rollover; take the stars back
            // there too so undone stars never reach that month's ceremony.
            // An earlier month not rolled over yet still lives in the counter.
            const counterHoldsLogMonth = !isCurrentMonth && scoreDoc.exists()
                && scoreDoc.data().lastMonthlyResetDate === `${deletedLogMonthKey}-01`;
            const historyRef = !isCurrentMonth && !counterHoldsLogMonth && starCredit
                ? doc(db, `${publicDataPath}/student_scores/${studentId}/monthly_history/${deletedLogMonthKey}`)
                : null;
            const historyDoc = historyRef ? await transaction.get(historyRef) : null;
            if (scoreDoc.exists()) {
                const updates = { totalStars: increment(-starCredit) };
                if (isCurrentMonth) {
                    Object.assign(updates, monthlyStarsChange(transaction, studentId, scoreDoc.data(), -starCredit));
                } else if (counterHoldsLogMonth) {
                    updates.monthlyStars = increment(-starCredit);
                }
                transaction.update(scoreRef, updates);
            }
            if (historyDoc?.exists()) {
                const archived = Number(historyDoc.data().stars) || 0;
                transaction.update(historyRef, { stars: Math.max(0, archived - starCredit) });
            }

            transaction.delete(logRef);

            // Bonus-only stars (Showdown, Quiz of the Week, Quiet Dragon) and Star Manager rows
            // never made a today_stars record
            if (logData.date === getTodayDateString() && !isBonusOnlyAwardLog(logData) && !isStarManagerAwardLog(logData)) {
                const todayStarsQuery = query(
                    collection(db, `${publicDataPath}/today_stars`),
                    where("studentId", "==", studentId),
                    where("teacherId", "==", state.get("currentUserId")),
                );
                const todayStarsSnapshot = await getDocs(todayStarsQuery);
                todayStarsSnapshot.forEach((doc) =>
                    transaction.delete(doc.ref),
                );
            }
        });

        if (deletedGuildEvent) {
            recordGuildGloryEvent({
                guildId: deletedGuildEvent.guildId,
                studentId: deletedGuildEvent.studentId,
                classId: deletedGuildEvent.classId,
                source: `delete_${deletedGuildEvent.reason}`,
                starDelta: -deletedGuildEvent.starCredit,
                exactGlory: deletedGuildEvent.guildGlory != null ? -deletedGuildEvent.guildGlory : null,
                // Taken back from the Chapter the award was given in (if it is still running).
                chapter: deletedLogMonthKey || true,
                note: `Deleted award log ${logId}`,
            }).catch((error) => console.warn("Guild Glory delete adjustment failed:", error));
        }

        if (deletedLogMonthKey) {
            import("../../features/ceremonyStarCheck.js").then((m) => m.forgetCeremonyStarVerdict(deletedLogMonthKey));
        }
        showToast("Log entry deleted successfully!", "success");

        const logElement = document.getElementById(`log-entry-${logId}`);
        if (logElement) {
            logElement.style.transition =
                "opacity 0.3s ease, transform 0.3s ease";
            logElement.style.opacity = "0";
            logElement.style.transform = "scale(0.9)";
            setTimeout(() => {
                logElement.remove();
                import("../../ui/modals/log.js").then((m) =>
                    m.tidyLogbookAfterRemoval(),
                );
            }, 300);
        }
    } catch (error) {
        console.error("Error deleting award log:", error);
        showToast(`Failed to delete log entry: ${error.message}`, "error");
    }
}

export async function handleSaveAwardNote() {
    const logId = document.getElementById("award-note-log-id-input").value;
    const newNote = document.getElementById("award-note-textarea").value;
    try {
        await updateDoc(
            doc(db, `${PUBLIC_DATA_PATH}/award_log`, logId),
            { note: newNote },
        );
        showToast("Note saved!", "success");
        hideModal("award-note-modal");
        import("../../ui/modals/log.js").then((m) =>
            m.updateLogbookEntryNote(logId, newNote),
        );
    } catch (error) {
        console.error("Error saving award note:", error);
        showToast("Failed to save note.", "error");
    }
}

/**
 * Applies outward skill effects (guildmate gold, classmate gold, random classmate gold)
 * to other students after the main star transaction completes. Fire-and-forget.
 */
async function _applyOutwardSkillEffects(
    awardedStudentId,
    classId,
    reason,
    difference,
    options = {},
) {
    if (!canUseFeature("heroProgression")) return;

    const student = state
        .get("allStudents")
        .find((s) => s.id === awardedStudentId);
    if (!student) return;

    const scoreData = state
        .get("allStudentScores")
        .find((s) => s.id === awardedStudentId);
    if (!scoreData?.heroSkills?.length) return;

    const outwardEffects = getOutwardEffects(
        student.heroClass,
        scoreData.heroSkills,
        reason,
        difference,
    );
    if (!outwardEffects.length) return;

    const publicDataPath = PUBLIC_DATA_PATH;
    const allStudents = state.get("allStudents");
    const giftReceiverId = String(options.giftReceiverId || "").trim();

    const batch = writeBatch(db);
    let hasBatchWrites = false;
    /** @type {Map<string, number>} */
    const goldDeltasByStudentId = new Map();

    const currentMonthKey = getMonthKey(); // "YYYY-MM" (local month)

    const addGoldDelta = (studentId, amount) => {
        goldDeltasByStudentId.set(
            studentId,
            (goldDeltasByStudentId.get(studentId) || 0) + amount,
        );
    };

    for (const eff of outwardEffects) {
        let targets = [];

        if (eff.type === "classmate_gold_on_reason") {
            if (giftReceiverId) {
                const receiver = allStudents.find((s) => s.id === giftReceiverId);
                targets = receiver && receiver.id !== awardedStudentId ? [receiver] : [];
            } else if (options.wholeClass) {
                // Class-wide awards (Training Grounds): every classmate earned it too.
                targets = allStudents.filter(
                    (s) => s.id !== awardedStudentId && s.classId === classId,
                );
            } else {
                const todaysStars = state.get("todaysStars");
                targets = allStudents.filter(
                    (s) =>
                        s.id !== awardedStudentId &&
                        s.classId === classId &&
                        todaysStars[s.id]?.reason === reason,
                );
            }
        } else if (eff.type === "guildmate_gold_on_reason") {
            targets = allStudents.filter(
                (s) =>
                    s.id !== awardedStudentId &&
                    s.guildId &&
                    s.guildId === student.guildId,
            );
        } else if (eff.type === "random_classmate_gold") {
            const classmates = allStudents.filter(
                (s) => s.id !== awardedStudentId && s.classId === classId,
            );
            if (classmates.length > 0) {
                targets = [
                    classmates[Math.floor(Math.random() * classmates.length)],
                ];
            }
        } else if (eff.type === "first_of_month_guild_bonus") {
            // Only fires the FIRST time this student earns their class reason this month
            const alreadyFiredThisMonth =
                scoreData.lastGuildBonusMonth === currentMonthKey;
            if (!alreadyFiredThisMonth) {
                // Mark as fired for this month on the awarding student's score
                const awardedRef = doc(
                    db,
                    `${publicDataPath}/student_scores`,
                    awardedStudentId,
                );
                batch.update(awardedRef, {
                    lastGuildBonusMonth: currentMonthKey,
                });
                hasBatchWrites = true;

                // Give gold to all guildmates
                targets = allStudents.filter(
                    (s) =>
                        s.id !== awardedStudentId &&
                        s.guildId &&
                        s.guildId === student.guildId,
                );
            }
        }

        for (const target of targets) {
            addGoldDelta(target.id, eff.amount);
        }
    }

    if (goldDeltasByStudentId.size > 0) {
        const goldEntries = [...goldDeltasByStudentId.entries()];
        const freshSnaps = await Promise.all(
            goldEntries.map(([studentId]) =>
                getDoc(
                    doc(
                        db,
                        `${publicDataPath}/student_scores`,
                        studentId,
                    ),
                ),
            ),
        );

        for (let i = 0; i < goldEntries.length; i++) {
            const [studentId, delta] = goldEntries[i];
            const snap = freshSnaps[i];
            if (!snap.exists()) continue;

            const targetRef = doc(
                db,
                `${publicDataPath}/student_scores`,
                studentId,
            );
            const data = snap.data();
            const baseGold = getLiveYearGold(
                data,
                getLiveYearGoldContextFromState(state),
            );
            batch.update(targetRef, { gold: Math.max(0, baseGold + delta) });
            hasBatchWrites = true;
        }
    }

    if (hasBatchWrites) await batch.commit();
}
