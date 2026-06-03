// /db/listeners.js

import {
    db,
    collection,
    query,
    where,
    onSnapshot,
    orderBy,
    doc,
    getDoc,
    getDocs,
    writeBatch,
    collectionGroup,
    limit,
} from "../firebase.js";
import * as state from "../state.js";
import { getStartOfMonthString, getTodayDateString } from "../utils.js";
import {
    renderClassLeaderboardTab,
    renderManageClassesTab,
    renderAwardStarsTab,
    renderIdeasTabSelects,
    renderAdventureLogTab,
    renderStudentLeaderboardTab,
    renderManageStudentsTab,
    renderAwardStarsStudentList,
    renderCalendarTab,
    renderStarManagerStudentSelect,
    renderAdventureLog,
    updateAwardCardState,
    updateAwardBoonButtons,
} from "../ui/tabs.js";

import {
    renderScholarsScrollTab,
    renderTrialHistoryContent,
} from "../features/scholarScroll.js";
import {
    updateStudentCardAttendanceState,
    findAndSetCurrentClass,
} from "../ui/core.js";
import { checkAndResetMonthlyStars } from "./actions.js";
import { renderStoryArchive } from "../features/storyWeaver.js";
import { updateCeremonyStatus } from "../features/ceremony.js";
import * as utils from "../utils.js";
import { competitionStart, DEFAULT_SCHOOL_NAME } from "../constants.js";
import * as modals from "../ui/modals.js";
import { renderFamiliarOptionsUi } from "../features/familiars.js";
import { renderHomeTab } from "../features/home.js";
import {
    reconcileFamiliarLifecycle,
    shouldPassivelyReconcileFamiliar,
} from "../features/familiars.js";
import { refreshSetupClassesList } from "../features/schoolSetup.js";
import { setSchoolGraceConfig } from "../utils/subscription.js";
import { parseGraceWindow } from "../features/teacherJourney.js";
import {
    CURRENT_SCHOOL_YEAR_KEY,
} from "../constants.js";
import {
    getDefaultSchoolYears,
    isActiveStudent,
    isActiveYearDoc,
    normalizeSchoolYearState,
} from "../utils/schoolYear.js";

function maybeRenderSecretaryPortal(tabKey) {
    const screen = document.getElementById("secretary-screen");
    if (!screen || screen.classList.contains("hidden")) return;
    import("../features/secretaryConsole.js").then((module) => {
        module.renderSecretaryConsole(tabKey);
    });
}

function maybeRenderParentPortal(tabKey) {
    const screen = document.getElementById("parent-screen");
    if (!screen || screen.classList.contains("hidden")) return;
    import("../features/parentPortal.js").then((module) => {
        module.renderParentPortal(tabKey);
    });
}

export async function refreshParentPortalData() {
    const profile = state.get("currentUserProfile");
    const studentId = profile?.linkedStudentId;
    if (!studentId) return;
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const snapshotRef = doc(db, `${publicDataPath}/parent_snapshots`, studentId);
    const snapshot = await getDoc(snapshotRef);
    state.setCurrentParentSnapshot(
        snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null,
    );
}

function clearDataListeners() {
    state.get("unsubscribeClasses")();
    state.get("unsubscribeStudents")();
    state.get("unsubscribeStudentScores")();
    state.get("unsubscribeTodaysStars")();
    state.get("unsubscribeAwardLogs")();
    state.get("unsubscribeQuestEvents")();
    state.get("unsubscribeAdventureLogs")();
    state.get("unsubscribeQuestAssignments")();
    state.get("unsubscribeCompletedStories")();
    state.get("unsubscribeWrittenScores")();
    state.get("unsubscribeAttendance")();
    state.get("unsubscribeScheduleOverrides")();
    state.get("unsubscribeHeroChronicleNotes")();
    state.get("unsubscribeSchoolSettings")();
    state.get("unsubscribeSchoolYearState")();
    state.get("unsubscribeSchoolYears")();
    state.get("unsubscribeRolloverJob")();
    state.get("unsubscribeTeacherSettings")();
    state.get("unsubscribeQuestBounties")();
    state.get("unsubscribeGuildScores")();
    state.get("unsubscribeGuildChampions")();
    state.get("unsubscribeFortuneWheelLog")();
    state.get("unsubscribeParentSnapshot")();
    state.get("unsubscribeParentHomework")();
    state.get("unsubscribeCommunicationThreads")();
    state.get("unsubscribeCommunicationMessages")();
    state.get("unsubscribeShopItems")();
}

export function watchCommunicationThread(threadId) {
    state.get("unsubscribeCommunicationMessages")();
    state.setCurrentCommunicationThreadId(threadId || null);
    state.setCurrentCommunicationMessages([]);
    if (!threadId) return;

    const publicDataPath = "artifacts/great-class-quest/public/data";
    const messagesQuery = query(
        collection(db, `${publicDataPath}/communication_messages`),
        where("threadId", "==", threadId),
        orderBy("createdAt", "desc"),
    );
    state.setUnsubscribeCommunicationMessages(
        onSnapshot(
            messagesQuery,
            (snapshot) => {
                state.setCurrentCommunicationMessages(
                    snapshot.docs
                        .map((docSnap) => ({
                            id: docSnap.id,
                            ...docSnap.data(),
                        }))
                        .reverse(),
                );
                if (
                    !document
                        .getElementById("parent-screen")
                        ?.classList.contains("hidden")
                ) {
                    maybeRenderParentPortal("messages");
                }
                if (
                    !document
                        .getElementById("secretary-screen")
                        ?.classList.contains("hidden")
                ) {
                    maybeRenderSecretaryPortal("messages");
                }
            },
            (error) =>
                console.error(
                    "Error listening to communication_messages:",
                    error,
                ),
        ),
    );
}

function subscribeCommunicationThreads({ userId, isSecretary = false }) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const threadsQuery = isSecretary
        ? query(
              collection(db, `${publicDataPath}/communication_threads`),
              orderBy("lastMessageAt", "desc"),
          )
        : query(
              collection(db, `${publicDataPath}/communication_threads`),
              where("participantUids", "array-contains", userId),
              orderBy("lastMessageAt", "desc"),
          );

    state.setUnsubscribeCommunicationThreads(
        onSnapshot(
            threadsQuery,
            (snapshot) => {
                const threads = snapshot.docs.map((docSnap) => ({
                    id: docSnap.id,
                    ...docSnap.data(),
                }));
                state.setCurrentCommunicationThreads(threads);
                const activeThreadId = state.get(
                    "currentCommunicationThreadId",
                );
                if (!activeThreadId && threads[0]?.id) {
                    watchCommunicationThread(threads[0].id);
                } else if (
                    activeThreadId &&
                    !threads.find((item) => item.id === activeThreadId)
                ) {
                    watchCommunicationThread(threads[0]?.id || null);
                }
                if (
                    !document
                        .getElementById("parent-screen")
                        ?.classList.contains("hidden")
                ) {
                    maybeRenderParentPortal("messages");
                }
                if (
                    !document
                        .getElementById("secretary-screen")
                        ?.classList.contains("hidden")
                ) {
                    maybeRenderSecretaryPortal("messages");
                }
            },
            (error) =>
                console.error(
                    "Error listening to communication_threads:",
                    error,
                ),
        ),
    );
}

export function setupParentSession(userId, profile, onInitialDataReady) {
    clearDataListeners();

    const publicDataPath = "artifacts/great-class-quest/public/data";
    const studentId = profile?.linkedStudentId;
    if (!studentId) {
        state.setCurrentParentSnapshot(null);
        state.setCurrentParentHomework([]);
        state.setCurrentCommunicationThreads([]);
        state.setCurrentCommunicationMessages([]);
        if (typeof onInitialDataReady === "function") onInitialDataReady();
        return;
    }

    let snapshotReady = false;
    let schoolSettingsReady = false;
    const maybeReady = () => {
        if (
            snapshotReady &&
            schoolSettingsReady &&
            typeof onInitialDataReady === "function"
        ) {
            onInitialDataReady();
        }
    };

    const parentSnapshotRef = doc(
        db,
        `${publicDataPath}/parent_snapshots`,
        studentId,
    );
    const homeworkQuery = query(
        collection(db, `${publicDataPath}/parent_homework`),
        where("studentId", "==", studentId),
        where("status", "==", "published"),
        orderBy("updatedAt", "desc"),
        limit(20),
    );
    const schoolSettingsQuery = doc(
        db,
        `${publicDataPath}/school_settings`,
        "holidays",
    );

    state.setUnsubscribeParentSnapshot(
        onSnapshot(
            parentSnapshotRef,
            (snapshot) => {
                state.setCurrentParentSnapshot(
                    snapshot.exists()
                        ? { id: snapshot.id, ...snapshot.data() }
                        : null,
                );
                snapshotReady = true;
                maybeReady();
                maybeRenderParentPortal("home");
            },
            (error) =>
                console.error("Error listening to parent snapshot:", error),
        ),
    );

    state.setUnsubscribeParentHomework(
        onSnapshot(
            homeworkQuery,
            (snapshot) => {
                state.setCurrentParentHomework(
                    snapshot.docs.map((docSnap) => ({
                        id: docSnap.id,
                        ...docSnap.data(),
                    })),
                );
                maybeRenderParentPortal("homework");
            },
            (error) =>
                console.error("Error listening to parent homework:", error),
        ),
    );

    state.setUnsubscribeSchoolSettings(
        onSnapshot(schoolSettingsQuery, (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                state.setSchoolName(data.schoolName || null);
                state.setSchoolHolidayRanges(data.ranges || []);
                const weatherLocation = utils.normalizeWeatherLocation(
                    data.weatherLocation,
                );
                state.setSchoolWeatherLocation(weatherLocation);
                utils.setWeatherCoordinates(weatherLocation);
                document
                    .querySelectorAll("[data-school-name]")
                    .forEach((el) => {
                        el.textContent = data.schoolName || DEFAULT_SCHOOL_NAME;
                    });
            }
            schoolSettingsReady = true;
            maybeReady();
        }),
    );

    subscribeCommunicationThreads({ userId, isSecretary: false });
}

export async function setupDataListeners(
    userId,
    dateString,
    onInitialDataReady,
    options = {},
) {
    const isSecretary = options.role === "secretary";
    let initialReadyFired = false;
    let classesReady = false;
    let schoolSettingsReady = false;
    let schoolYearReady = false;
    let specialHeroProgressionReconciled = false;

    // --- Performance helpers ---
    // Returns true only if a tab element is currently visible (not hidden).
    // This lets listeners skip re-rendering tabs the user isn't looking at;
    // showTab() already re-renders on navigation so nothing is missed.
    function isTabVisible(tabId) {
        return !document.getElementById(tabId)?.classList.contains("hidden");
    }

    // Phase 5: Per-student throttle for passive familiar reconciliation.
    // Avoids firing reconcileFamiliarLifecycle() for every student on initial load.
    const familiarReconcileLastRun = new Map();
    const FAMILIAR_RECONCILE_COOLDOWN_MS = 60_000;

    // Phase 6: One-time guard for guild glory migration per session.
    let gloryMigrationChecked = false;

    function maybeFireInitialReady() {
        if (
            typeof onInitialDataReady === "function" &&
            !initialReadyFired &&
            classesReady &&
            schoolSettingsReady &&
            schoolYearReady
        ) {
            initialReadyFired = true;
            onInitialDataReady();
        }
    }
    function maybeReconcileSpecialHeroProgression() {
        if (specialHeroProgressionReconciled) return;
        if (
            !state.get("allStudents").length ||
            !state.get("allStudentScores").length
        )
            return;
        specialHeroProgressionReconciled = true;
        import("./actions.js")
            .then((actions) =>
                actions.reconcileScholarAndNomadProgressFromLogs(),
            )
            .catch((error) =>
                console.warn(
                    "Special hero progression reconciliation failed:",
                    error,
                ),
            );
    }

    clearDataListeners();

    const publicDataPath = "artifacts/great-class-quest/public/data";
    const schoolYearStateRef = doc(
        db,
        `${publicDataPath}/school_year_state`,
        "current",
    );
    try {
        const schoolYearStateSnap = await getDoc(schoolYearStateRef);
        if (schoolYearStateSnap.exists()) {
            state.setSchoolYearState(schoolYearStateSnap.data());
        }
    } catch (error) {
        console.warn("Could not preload school year state:", error);
    }
    const initialSchoolYearState = normalizeSchoolYearState(
        state.get("schoolYearState"),
    );
    const activeYearKey =
        initialSchoolYearState.activeYearKey || CURRENT_SCHOOL_YEAR_KEY;
    const enforceActiveYearQueries =
        initialSchoolYearState.enforceActiveYearQueries === true;
    const includeUntagged = !enforceActiveYearQueries;

    const schoolYearsQuery = query(
        collection(db, `${publicDataPath}/school_years`),
    );

    state.setUnsubscribeSchoolYearState(
        onSnapshot(
            schoolYearStateRef,
            (snap) => {
                state.setSchoolYearState(snap.exists() ? snap.data() : {});
                schoolYearReady = true;
                maybeFireInitialReady();
                if (isTabVisible("about-tab")) renderHomeTab();
                const secretaryScreen = document.getElementById("secretary-screen");
                if (secretaryScreen && !secretaryScreen.classList.contains("hidden")) {
                    maybeRenderSecretaryPortal("admin");
                }
            },
            (error) => {
                console.error("Error listening to school year state:", error);
                schoolYearReady = true;
                maybeFireInitialReady();
            },
        ),
    );

    state.setUnsubscribeSchoolYears(
        onSnapshot(
            schoolYearsQuery,
            (snapshot) => {
                const years = snapshot.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                }));
                state.setAllSchoolYears(years.length ? years : getDefaultSchoolYears());
            },
            (error) => console.error("Error listening to school years:", error),
        ),
    );

    // --- Teacher profile/settings doc (holds schoolYearSettings.classEndDates, grandCeremonyHistory, etc.) ---
    // The doc may not exist yet for first-time teachers; treat that as empty settings.
    // We don't gate maybeFireInitialReady() on this — it's a small, optional read.
    if (!isSecretary) {
        const teacherDocRef = doc(db, `${publicDataPath}/teachers`, userId);
        state.setUnsubscribeTeacherSettings(
            onSnapshot(
                teacherDocRef,
                (snap) => {
                    state.setTeacherSettings(snap.exists() ? snap.data() : {});
                    // Refresh Grand Guild Ceremony buttons since they depend on classEndDates.
                    import("../features/grandGuildCeremony.js")
                        .then((m) => m.updateCeremonyButtons?.())
                        .catch(() => {
                            /* feature may be lazy-loaded later */
                        });
                },
                (error) =>
                    console.error(
                        "Error listening to teacher settings:",
                        error,
                    ),
            ),
        );
    }

    // --- Time-bounded Definitions ---
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const now = new Date();
    const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfMonthString = startOfCurrentMonth.toISOString().split("T")[0];

    const competitionStartDateString = competitionStart
        .toISOString()
        .split("T")[0];

    // --- Define Queries ---
    const classesQuery = enforceActiveYearQueries
        ? query(
              collection(db, `${publicDataPath}/classes`),
              where("schoolYearKey", "==", activeYearKey),
              where("status", "==", "active"),
          )
        : query(collection(db, `${publicDataPath}/classes`));
    const studentsQuery = enforceActiveYearQueries
        ? query(
              collection(db, `${publicDataPath}/students`),
              where("activeSchoolYearKey", "==", activeYearKey),
          )
        : query(collection(db, `${publicDataPath}/students`));
    const scoresQuery = enforceActiveYearQueries
        ? query(
              collection(db, `${publicDataPath}/student_scores`),
              where("activeSchoolYearKey", "==", activeYearKey),
          )
        : query(collection(db, `${publicDataPath}/student_scores`));
    const todaysStarsQuery = query(
        collection(db, `${publicDataPath}/today_stars`),
        where("teacherId", "==", userId),
        where("date", "==", dateString),
    );
    const questEventsQuery = enforceActiveYearQueries
        ? query(
              collection(db, `${publicDataPath}/quest_events`),
              where("schoolYearKey", "==", activeYearKey),
          )
        : query(collection(db, `${publicDataPath}/quest_events`));
    const questAssignmentsQuery = isSecretary
        ? query(collection(db, `${publicDataPath}/quest_assignments`))
        : query(
              collection(db, `${publicDataPath}/quest_assignments`),
              where("createdBy.uid", "==", userId),
          );
    const completedStoriesQuery = query(
        collection(db, `${publicDataPath}/completed_stories`),
        orderBy("completedAt", "desc"),
        limit(100),
    );
    const overridesQuery = enforceActiveYearQueries
        ? query(
              collection(db, `${publicDataPath}/schedule_overrides`),
              where("schoolYearKey", "==", activeYearKey),
          )
        : query(collection(db, `${publicDataPath}/schedule_overrides`));
    const heroChronicleNotesQuery = isSecretary
        ? query(collection(db, `${publicDataPath}/hero_chronicle_notes`))
        : query(
              collection(db, `${publicDataPath}/hero_chronicle_notes`),
              where("teacherId", "==", userId),
          );
    const questBountiesQuery = isSecretary
        ? query(collection(db, `${publicDataPath}/quest_bounties`))
        : query(
              collection(db, `${publicDataPath}/quest_bounties`),
              where("createdBy.uid", "==", userId),
          );
    const shopItemsQuery = isSecretary
        ? query(collection(db, `${publicDataPath}/shop_items`))
        : query(
              collection(db, `${publicDataPath}/shop_items`),
              where("teacherId", "==", userId),
          );
    const schoolSettingsQuery = doc(
        db,
        `${publicDataPath}/school_settings`,
        "holidays",
    );
    const guildScoresQuery = query(
        collection(db, `${publicDataPath}/guild_scores`),
    );

    // --- Optimized Queries (Time-Bounded) ---

    // 1. Current Month Range for Award Logs (Real-time)
    const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const awardLogsQuery = query(
        collection(db, `${publicDataPath}/award_log`),
        ...(enforceActiveYearQueries
            ? [where("schoolYearKey", "==", activeYearKey)]
            : []),
        where("createdAt", ">=", startOfCurrentMonth),
        where("createdAt", "<", startOfNextMonth),
    );

    // 2. Adventure Logs (Last 30 days is fine, or match month)
    const adventureLogsQuery = query(
        collection(db, `${publicDataPath}/adventure_logs`),
        ...(enforceActiveYearQueries
            ? [where("schoolYearKey", "==", activeYearKey)]
            : []),
        where("createdAt", ">=", thirtyDaysAgo),
        orderBy("createdAt", "desc"),
    );

    // REVAMP: Attendance now only fetches the last 30 days real-time. Older data is fetched on demand.
    const attendanceQuery = isSecretary
        ? query(
              collection(db, `${publicDataPath}/attendance`),
              where("createdAt", ">=", thirtyDaysAgo),
          )
        : query(
              collection(db, `${publicDataPath}/attendance`),
              where("markedBy.uid", "==", userId),
              where("createdAt", ">=", thirtyDaysAgo),
          );

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoString = threeMonthsAgo.toISOString().split("T")[0];

    const writtenScoresQuery = isSecretary
        ? query(
              collection(db, `${publicDataPath}/written_scores`),
              where("date", ">=", threeMonthsAgoString),
          )
        : query(
              collection(db, `${publicDataPath}/written_scores`),
              where("teacherId", "==", userId),
              where("date", ">=", threeMonthsAgoString),
              orderBy("date", "desc"),
          );

    function applySchoolNameToDom(name) {
        const display = name || DEFAULT_SCHOOL_NAME;
        document.querySelectorAll("[data-school-name]").forEach((el) => {
            el.textContent = display;
        });
    }

    // --- Attach Listeners ---
    state.setUnsubscribeClasses(
        onSnapshot(
            classesQuery,
            (snapshot) => {
                const schoolClasses = snapshot.docs
                    .map((d) => ({
                        id: d.id,
                        ...d.data(),
                    }))
                    .filter((item) =>
                        isActiveYearDoc(item, activeYearKey, {
                            includeUntagged,
                        }),
                    );
                state.setAllSchoolClasses(schoolClasses);
                state.setAllTeachersClasses(
                    isSecretary
                        ? schoolClasses
                        : schoolClasses.filter(
                              (c) => c.createdBy?.uid === userId,
                          ),
                );
                classesReady = true;
                maybeFireInitialReady();
                refreshSetupClassesList();
                // Smart class selector — sets class + league only when classFollowSchedule
                // and a lesson is active (never “imply” a league from the clock alone).
                findAndSetCurrentClass();
                if (isTabVisible("class-leaderboard-tab"))
                    renderClassLeaderboardTab();
                if (isTabVisible("my-classes-tab")) renderManageClassesTab();
                if (isTabVisible("calendar-tab")) renderCalendarTab();
                if (isTabVisible("award-stars-tab"))
                    renderAwardStarsTab({ preserveStudentOrder: true });
                if (isTabVisible("reward-ideas-tab")) renderIdeasTabSelects();
                if (isTabVisible("adventure-log-tab")) renderAdventureLogTab();
                if (isTabVisible("scholars-scroll-tab"))
                    void renderScholarsScrollTab().catch((e) =>
                        console.warn("Scholar scroll render:", e),
                    );
                if (
                    document.getElementById("options-tab") &&
                    !document
                        .getElementById("options-tab")
                        .classList.contains("hidden")
                ) {
                    renderStarManagerStudentSelect();
                    renderFamiliarOptionsUi();
                }
                updateCeremonyStatus();
                renderHomeTab(); // Always update — home is the default active tab
                if (isSecretary) {
                    maybeRenderSecretaryPortal("school");
                    maybeRenderSecretaryPortal("home");
                }
            },
            (error) => console.error("Error listening to classes:", error),
        ),
    );

    state.setUnsubscribeStudents(
        onSnapshot(
            studentsQuery,
            (snapshot) => {
                const allStudents = snapshot.docs
                    .map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    }))
                    .filter((item) =>
                        isActiveStudent(item, activeYearKey, {
                            includeUntagged,
                        }),
                    );
                state.setAllStudents(
                    allStudents.sort((a, b) => a.name.localeCompare(b.name)),
                );
                maybeReconcileSpecialHeroProgression();

                const guildsTab = document.getElementById("guilds-tab");
                if (guildsTab && !guildsTab.classList.contains("hidden")) {
                    import("../ui/tabs/guilds.js").then((m) =>
                        m.renderGuildsTab(),
                    );
                }
                if (isTabVisible("student-leaderboard-tab"))
                    renderStudentLeaderboardTab();
                if (isTabVisible("class-leaderboard-tab"))
                    renderClassLeaderboardTab();
                if (isTabVisible("manage-students-tab"))
                    renderManageStudentsTab();
                if (isTabVisible("award-stars-tab"))
                    renderAwardStarsStudentList(
                        state.get("globalSelectedClassId"),
                        false,
                    );
                if (isTabVisible("scholars-scroll-tab"))
                    void renderScholarsScrollTab(
                        state.get("globalSelectedClassId"),
                    ).catch((e) => console.warn("Scholar scroll render:", e));
                if (
                    document.getElementById("options-tab") &&
                    !document
                        .getElementById("options-tab")
                        .classList.contains("hidden")
                ) {
                    renderStarManagerStudentSelect();
                    renderFamiliarOptionsUi();
                }
                renderHomeTab(); // Always update — home is the default active tab
                if (isSecretary) {
                    maybeRenderSecretaryPortal("school");
                    maybeRenderSecretaryPortal("home");
                }
                // --- NEW: Check for missing genders in background ---
                // Debounce this slightly so it doesn't fire while typing a new name
                if (window.genderCheckTimeout)
                    clearTimeout(window.genderCheckTimeout);
                window.genderCheckTimeout = setTimeout(() => {
                    import("../db/actions.js").then((a) =>
                        a.resolveMissingGenders(),
                    );
                }, 3000); // Wait 3 seconds after data loads
            },
            (error) => console.error("Error listening to students:", error),
        ),
    );

    state.setUnsubscribeStudentScores(
        onSnapshot(
            scoresQuery,
            (snapshot) => {
                const currentMonthStart = getStartOfMonthString();
                const allStudentScores = snapshot.docs
                    .map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    }))
                    .filter((item) =>
                        isActiveYearDoc(item, activeYearKey, {
                            field: "activeSchoolYearKey",
                            includeUntagged,
                        }),
                    );
                state.setAllStudentScores(allStudentScores);
                maybeReconcileSpecialHeroProgression();

                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added" || change.type === "modified") {
                        const scoreData = change.doc.data();
                        const studentId = change.doc.id;

                        if (
                            scoreData.lastMonthlyResetDate !== currentMonthStart
                        ) {
                            // Only reset MY students — writing sub-collections on other teachers'
                            // students causes Firebase 403 permission-denied errors.
                            const student = state
                                .get("allStudents")
                                .find((s) => s.id === studentId);
                            if (student?.createdBy?.uid === userId) {
                                checkAndResetMonthlyStars(
                                    studentId,
                                    currentMonthStart,
                                );
                            }
                        }

                        const newMonthly = scoreData.monthlyStars || 0;
                        const newTotal = scoreData.totalStars || 0;

                        const monthlyEl = document.getElementById(
                            `monthly-stars-${studentId}`,
                        );
                        const totalEl = document.getElementById(
                            `total-stars-${studentId}`,
                        );
                        const newGold =
                            scoreData.gold !== undefined
                                ? scoreData.gold
                                : newTotal; // Fallback
                        const goldEl = document.getElementById(
                            `student-gold-display-${studentId}`,
                        );

                        if (goldEl && goldEl.innerText != newGold) {
                            goldEl.innerText = newGold;
                            // Trigger the CSS animation on the parent pill
                            const pill = goldEl.closest(".coin-pill");
                            if (pill) {
                                pill.classList.remove("coin-update-anim"); // Reset
                                void pill.offsetWidth; // Force reflow
                                pill.classList.add("coin-update-anim");
                            }
                        }

                        // Also update the shop gold display if this student is selected in the shop
                        const shopStudentSelect = document.getElementById(
                            "shop-student-select",
                        );
                        const shopGoldEl =
                            document.getElementById("shop-student-gold");
                        if (
                            shopGoldEl &&
                            shopStudentSelect &&
                            shopStudentSelect.value === studentId
                        ) {
                            shopGoldEl.innerText = `${newGold} 🪙`;
                        }

                        if (monthlyEl && monthlyEl.textContent != newMonthly) {
                            monthlyEl.textContent = newMonthly;
                            const bubble = monthlyEl.closest(".counter-bubble");
                            if (bubble) {
                                bubble.classList.add("counter-animate");
                                setTimeout(
                                    () =>
                                        bubble.classList.remove(
                                            "counter-animate",
                                        ),
                                    500,
                                );
                            }
                        }

                        if (totalEl && totalEl.textContent != newTotal) {
                            totalEl.textContent = newTotal;
                            const bubble = totalEl.closest(".counter-bubble");
                            if (bubble) {
                                bubble.classList.add("counter-animate");
                                setTimeout(
                                    () =>
                                        bubble.classList.remove(
                                            "counter-animate",
                                        ),
                                    500,
                                );
                            }
                        }

                        const ownerUid =
                            scoreData.createdBy?.uid ||
                            state
                                .get("allStudents")
                                .find((s) => s.id === studentId)?.createdBy
                                ?.uid;
                        if (
                            ownerUid === userId &&
                            shouldPassivelyReconcileFamiliar(scoreData)
                        ) {
                            // Throttle: only reconcile each student's familiar once per minute to avoid
                            // firing for every student simultaneously on initial load.
                            const lastRun =
                                familiarReconcileLastRun.get(studentId) || 0;
                            if (
                                Date.now() - lastRun >=
                                FAMILIAR_RECONCILE_COOLDOWN_MS
                            ) {
                                familiarReconcileLastRun.set(
                                    studentId,
                                    Date.now(),
                                );
                                reconcileFamiliarLifecycle(studentId, {
                                    announce: false,
                                    source: "listener-passive",
                                }).catch((e) =>
                                    console.warn(
                                        "Passive familiar reconciliation failed:",
                                        e,
                                    ),
                                );
                            }
                        }
                    }
                });

                const manageStudentsTab = document.getElementById(
                    "manage-students-tab",
                );
                if (
                    manageStudentsTab &&
                    !manageStudentsTab.classList.contains("hidden")
                ) {
                    renderManageStudentsTab();
                }

                const guildsTab = document.getElementById("guilds-tab");
                if (guildsTab && !guildsTab.classList.contains("hidden")) {
                    import("../ui/tabs/guilds.js").then((m) =>
                        m.renderGuildsTab(),
                    );
                }
                if (isTabVisible("student-leaderboard-tab"))
                    renderStudentLeaderboardTab();
                if (isTabVisible("class-leaderboard-tab"))
                    renderClassLeaderboardTab();
                if (
                    document.getElementById("options-tab") &&
                    !document
                        .getElementById("options-tab")
                        .classList.contains("hidden")
                ) {
                    renderFamiliarOptionsUi();
                }

                // Update boon buttons in award tab when leaderboard changes
                updateAwardBoonButtons(state.get("globalSelectedClassId"));

                import("../features/home.js").then((m) => m.renderHomeTab());
            },
            (error) =>
                console.error("Error listening to student_scores:", error),
        ),
    );

    // School settings listener is set up below (line ~398) to avoid duplicate listeners
    // It handles holidays, school name, and weather location

    state.setUnsubscribeTodaysStars(
        onSnapshot(
            todaysStarsQuery,
            (snapshot) => {
                const awardStarsTab =
                    document.getElementById("award-stars-tab");
                const isTabVisible =
                    awardStarsTab &&
                    !awardStarsTab.classList.contains("hidden");
                const adventureLogTab =
                    document.getElementById("adventure-log-tab");
                const isAdventureLogVisible =
                    adventureLogTab &&
                    !adventureLogTab.classList.contains("hidden");
                const currentTodaysStars = state.get("todaysStars");

                snapshot.docChanges().forEach((change) => {
                    const starData = change.doc.data();
                    const studentId = starData.studentId;

                    if (change.type === "added" || change.type === "modified") {
                        currentTodaysStars[studentId] = {
                            docId: change.doc.id,
                            stars: starData.stars,
                            reason: starData.reason,
                        };
                        if (isTabVisible) {
                            updateAwardCardState(
                                studentId,
                                starData.stars,
                                starData.reason,
                            );
                        }
                    } else if (change.type === "removed") {
                        delete currentTodaysStars[studentId];
                        if (isTabVisible) {
                            updateAwardCardState(studentId, 0, null);
                        }
                    }
                });

                state.set("todaysStars", currentTodaysStars);
                if (isAdventureLogVisible) renderAdventureLogTab();
                renderHomeTab(); // Update home tab (today's stars count)
            },
            (error) => console.error("Error listening to today_stars:", error),
        ),
    );

    state.setUnsubscribeAwardLogs(
        onSnapshot(
            awardLogsQuery,
            (snapshot) => {
                state.setAllAwardLogs(
                    snapshot.docs
                        .map((d) => ({ id: d.id, ...d.data() }))
                        .filter((item) =>
                            isActiveYearDoc(item, activeYearKey, {
                                includeUntagged,
                            }),
                        ),
                );
                const newTodaysAwardLogs = {};
                const today = getTodayDateString();
                state
                    .get("allAwardLogs")
                    .filter((l) => l.teacherId === userId && l.date === today)
                    .forEach((log) => {
                        newTodaysAwardLogs[log.studentId] = log.id;
                    });
                state.setTodaysAwardLogs(newTodaysAwardLogs);
                if (isTabVisible("calendar-tab")) renderCalendarTab();
                // Refresh boon button states when a peer boon is given (daily limit changes)
                updateAwardBoonButtons(state.get("globalSelectedClassId"));
            },
            (error) => console.error("Error listening to award logs:", error),
        ),
    );

    state.setUnsubscribeQuestEvents(
        onSnapshot(
            questEventsQuery,
            (snapshot) => {
                state.setAllQuestEvents(
                    snapshot.docs
                        .map((d) => ({ id: d.id, ...d.data() }))
                        .filter((item) =>
                            isActiveYearDoc(item, activeYearKey, {
                                includeUntagged,
                            }),
                        ),
                );
                if (isTabVisible("calendar-tab")) renderCalendarTab();
            },
            (error) => console.error("Error listening to quest events:", error),
        ),
    );

    state.setUnsubscribeAdventureLogs(
        onSnapshot(
            adventureLogsQuery,
            (snapshot) => {
                state.setAllAdventureLogs(
                    snapshot.docs
                        .map((d) => ({ id: d.id, ...d.data() }))
                        .filter((item) =>
                            isActiveYearDoc(item, activeYearKey, {
                                includeUntagged,
                            }),
                        ),
                );
                renderAdventureLog();
            },
            (error) =>
                console.error("Error listening to adventure logs:", error),
        ),
    );

    state.setUnsubscribeQuestAssignments(
        onSnapshot(
            questAssignmentsQuery,
            (snapshot) => {
                state.setAllQuestAssignments(
                    snapshot.docs
                        .map((d) => ({ id: d.id, ...d.data() }))
                        .filter((item) =>
                            isActiveYearDoc(item, activeYearKey, {
                                includeUntagged,
                            }),
                        ),
                );
            },
            (error) =>
                console.error("Error listening to quest assignments:", error),
        ),
    );

    state.setUnsubscribeCompletedStories(
        onSnapshot(
            completedStoriesQuery,
            (snapshot) => {
                state.setAllCompletedStories(
                    snapshot.docs
                        .map((d) => ({ id: d.id, ...d.data() }))
                        .filter((item) =>
                            isActiveYearDoc(item, activeYearKey, {
                                includeUntagged,
                            }),
                        ),
                );
                if (
                    document.getElementById("story-archive-modal") &&
                    !document
                        .getElementById("story-archive-modal")
                        .classList.contains("hidden")
                ) {
                    renderStoryArchive();
                }
            },
            (error) =>
                console.error("Error listening to completed stories:", error),
        ),
    );

    state.setUnsubscribeWrittenScores(
        onSnapshot(
            writtenScoresQuery,
            (snapshot) => {
                state.setAllWrittenScores(
                    snapshot.docs
                        .map((d) => ({ id: d.id, ...d.data() }))
                        .filter((item) =>
                            isActiveYearDoc(item, activeYearKey, {
                                includeUntagged,
                            }),
                        ),
                );
                const scrollClassId = state.get("globalSelectedClassId");
                if (scrollClassId) {
                    void renderScholarsScrollTab(scrollClassId).catch((e) =>
                        console.warn("Scholar scroll render:", e),
                    );
                }
                const trialHistoryModal = document.getElementById(
                    "trial-history-modal",
                );
                if (
                    trialHistoryModal &&
                    !trialHistoryModal.classList.contains("hidden")
                ) {
                    const classId = trialHistoryModal.dataset.classId;
                    const activeView =
                        document.querySelector(
                            "#trial-history-view-toggle .active-toggle",
                        )?.dataset.view || "test";
                    renderTrialHistoryContent(classId, activeView);
                }
                renderHomeTab(); // Update home tab (last test info)
                if (isSecretary) {
                    maybeRenderSecretaryPortal("grades");
                    maybeRenderSecretaryPortal("home");
                }
            },
            (error) => {
                console.error("Error listening to written scores:", error);
            },
        ),
    );

    state.setUnsubscribeAttendance(
        onSnapshot(
            attendanceQuery,
            (snapshot) => {
                // This state now only contains RECENT attendance (last 30 days)
                state.setAllAttendanceRecords(
                    snapshot.docs
                        .map((d) => ({ id: d.id, ...d.data() }))
                        .filter((item) =>
                            isActiveYearDoc(item, activeYearKey, {
                                includeUntagged,
                            }),
                        ),
                );

                snapshot.docChanges().forEach((change) => {
                    const attendanceData = change.doc.data();
                    const student = state
                        .get("allStudents")
                        .find((s) => s.id === attendanceData.studentId);
                    if (student) {
                        const classEndDates =
                            state.get("teacherSettings")?.schoolYearSettings
                                ?.classEndDates || {};
                        const lastLessonDate = utils.getLastLessonDate(
                            student.classId,
                            state.get("allSchoolClasses"),
                            state.get("allScheduleOverrides"),
                            state.get("schoolHolidayRanges"),
                            classEndDates,
                        );
                        // If the change is relevant to the most recent lesson, update the UI immediately
                        if (attendanceData.date === lastLessonDate) {
                            updateStudentCardAttendanceState(
                                attendanceData.studentId,
                                change.type !== "removed",
                            );
                        }
                    }
                });

                modals.scheduleAttendanceChronicleRefresh?.();
            },
            (error) => console.error("Error listening to attendance:", error),
        ),
    );

    state.setUnsubscribeScheduleOverrides(
        onSnapshot(
            overridesQuery,
            (snapshot) => {
                state.setAllScheduleOverrides(
                    snapshot.docs
                        .map((d) => ({ id: d.id, ...d.data() }))
                        .filter((item) =>
                            isActiveYearDoc(item, activeYearKey, {
                                includeUntagged,
                            }),
                        ),
                );
                renderCalendarTab();
                updateCeremonyStatus();
                renderHomeTab(); // Update home tab (schedule changes)
            },
            (error) =>
                console.error("Error listening to schedule overrides:", error),
        ),
    );

    state.setUnsubscribeHeroChronicleNotes(
        onSnapshot(
            heroChronicleNotesQuery,
            (snapshot) => {
                state.setAllHeroChronicleNotes(
                    snapshot.docs
                        .map((d) => ({ id: d.id, ...d.data() }))
                        .filter((item) =>
                            isActiveYearDoc(item, activeYearKey, {
                                includeUntagged,
                            }),
                        ),
                );
                const modal = document.getElementById("hero-chronicle-modal");
                if (modal && !modal.classList.contains("hidden")) {
                    const studentId = modal.dataset.studentId;
                    if (studentId) {
                        modals.renderHeroChronicleContent(studentId);
                    }
                }
            },
            (error) =>
                console.error(
                    "Error listening to hero chronicle notes:",
                    error,
                ),
        ),
    );

    state.setUnsubscribeQuestBounties(
        onSnapshot(
            questBountiesQuery,
            async (snapshot) => {
                state.setAllQuestBounties(
                    snapshot.docs
                        .map((d) => ({ id: d.id, ...d.data() }))
                        .filter((item) =>
                            isActiveYearDoc(item, activeYearKey, {
                                includeUntagged,
                            }),
                        ),
                );
                // Dynamically import to avoid circular dependency
                const { renderActiveBounties } = await import("../ui/core.js");
                renderActiveBounties();
                renderHomeTab();
            },
            (error) =>
                console.error("Error listening to quest bounties:", error),
        ),
    );

    state.setUnsubscribeShopItems(
        onSnapshot(shopItemsQuery, async (snapshot) => {
            state.setCurrentShopItems(
                snapshot.docs
                    .map((d) => ({ id: d.id, ...d.data() }))
                    .filter((item) =>
                        isActiveYearDoc(item, activeYearKey, {
                            includeUntagged,
                        }),
                    ),
            );
            // Real-time stock updates: Refresh shop UI if modal is open
            const shopModal = document.getElementById("shop-modal");
            if (shopModal && !shopModal.classList.contains("hidden")) {
                const { renderShopUI } = await import("../ui/core/shop.js");
                renderShopUI();
            }
        }),
    );

    state.setUnsubscribeSchoolSettings(
        onSnapshot(schoolSettingsQuery, async (docSnapshot) => {
            if (docSnapshot.exists()) {
                const data = docSnapshot.data();
                state.setSchoolHolidayRanges(data.ranges || []);
                state.setSchoolName(data.schoolName || null);
                const graceWindow = parseGraceWindow(data);
                state.setSchoolBillingGrace(graceWindow);
                setSchoolGraceConfig(graceWindow);
                const weatherLocation = utils.normalizeWeatherLocation(
                    data.weatherLocation,
                );
                state.setSchoolWeatherLocation(weatherLocation);
                state.setSchoolAssessmentDefaults(
                    data.assessmentDefaultsByLeague || null,
                );
                utils.setWeatherCoordinates(weatherLocation);
                applySchoolNameToDom(data.schoolName);
            } else {
                state.setSchoolHolidayRanges([]);
                state.setSchoolName(null);
                state.setSchoolBillingGrace(null);
                setSchoolGraceConfig(null);
                state.setSchoolWeatherLocation(null);
                state.setSchoolAssessmentDefaults(null);
                utils.setWeatherCoordinates(null);
                applySchoolNameToDom(null);
            }
            schoolSettingsReady = true;
            maybeFireInitialReady();
            utils.fetchSolarCycle();

            // Refresh UI
            // We use dynamic imports here to avoid circular dependency issues
            const { renderCalendarTab } = await import("../ui/tabs.js");
            renderCalendarTab();

            const optionsTab = document.getElementById("options-tab");
            if (optionsTab && !optionsTab.classList.contains("hidden")) {
                const { renderHolidayList } = await import("../ui/core.js");
                renderHolidayList();
            }
            renderHomeTab(); // Update home tab (holidays affect monthly stars calculation context)
        }),
    );

    state.setUnsubscribeGuildScores(
        onSnapshot(
            guildScoresQuery,
            (snapshot) => {
                const allGuildScores = {};
                snapshot.docs.forEach((d) => {
                    allGuildScores[d.id] = { id: d.id, ...d.data() };
                });
                state.setAllGuildScores(allGuildScores);
                // One-time Glory migration per session (guard prevents repeat on every snapshot)
                if (!gloryMigrationChecked) {
                    gloryMigrationChecked = true;
                    import("../features/guildScoring.js").then((m) =>
                        m.migrateGuildGloryIfNeeded(),
                    );
                }
                // Check weekly reset
                import("../features/guildScoring.js").then((m) =>
                    m.checkAndPerformWeeklyGloryReset(),
                );
                if (isTabVisible("student-leaderboard-tab"))
                    renderStudentLeaderboardTab();
                const guildsTab = document.getElementById("guilds-tab");
                if (guildsTab && !guildsTab.classList.contains("hidden")) {
                    import("../ui/tabs/guilds.js").then((m) =>
                        m.renderGuildsTab(),
                    );
                }
            },
            (error) => console.error("Error listening to guild_scores:", error),
        ),
    );

    // Guild Champions — current month
    const currentMonthKey = new Date().toISOString().substring(0, 7);
    const guildChampionsQuery = query(
        collection(db, `${publicDataPath}/guild_champions`),
        where("monthKey", "==", currentMonthKey),
    );
    state.setUnsubscribeGuildChampions(
        onSnapshot(
            guildChampionsQuery,
            (snapshot) => {
                const champions = {};
                snapshot.docs.forEach((d) => {
                    champions[d.data().guildId] = { ...d.data() };
                });
                state.setGuildChampions(champions);
                if (isTabVisible("student-leaderboard-tab"))
                    renderStudentLeaderboardTab();
            },
            (error) =>
                console.error("Error listening to guild_champions:", error),
        ),
    );

    // Fortune's Wheel Log — recent spins for all classes (limit 20)
    const wheelLogQuery = query(
        collection(db, `${publicDataPath}/fortune_wheel_log`),
        orderBy("spunAt", "desc"),
        limit(20),
    );
    state.setUnsubscribeFortuneWheelLog(
        onSnapshot(
            wheelLogQuery,
            (snapshot) => {
                const log = snapshot.docs.map((d) => ({
                    id: d.id,
                    ...d.data(),
                }));
                state.setFortuneWheelLog(log);
                const guildsTab = document.getElementById("guilds-tab");
                if (guildsTab && !guildsTab.classList.contains("hidden")) {
                    import("../ui/tabs/guilds.js").then((m) =>
                        m.renderGuildsTab(),
                    );
                }
            },
            (error) =>
                console.error("Error listening to fortune_wheel_log:", error),
        ),
    );

    subscribeCommunicationThreads({ userId, isSecretary });
}

export async function archivePreviousDayStars(userId, todayDateString) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const allStarsQuery = query(
        collection(db, `${publicDataPath}/today_stars`),
        where("teacherId", "==", userId),
    );
    const snapshot = await getDocs(allStarsQuery);
    const oldDocs = snapshot.docs.filter(
        (doc) => doc.data().date !== todayDateString,
    );
    if (oldDocs.length === 0) return;
    try {
        const batch = writeBatch(db);
        oldDocs.forEach((doc) => batch.delete(doc.ref));
        await batch.commit();
        console.log(
            `Archived and deleted ${oldDocs.length} old daily entries.`,
        );
    } catch (error) {
        console.error("Error archiving stars:", error);
    }
}
