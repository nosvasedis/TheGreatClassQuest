// /db/listeners.js

import {
    db,
    collection,
    query,
    where,
    onSnapshot as firebaseOnSnapshot,
    orderBy,
    doc,
    getDoc,
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
import { renderStoryArchive } from "../features/storyWeaver.js";
import { updateCeremonyStatus } from "../features/ceremony.js";
import * as utils from "../utils.js";
import { DEFAULT_SCHOOL_NAME } from "../constants.js";
import * as modals from "../ui/modals.js";
import { renderFamiliarOptionsUi } from "../features/familiars.js";
import { renderHomeTab } from "../features/home.js";
import { refreshSetupClassesList } from "../features/schoolSetup.js";
import { setSchoolGraceConfig } from "../utils/subscription.js";
import { parseGraceWindow } from "../features/teacherJourney.js";
import {
    isActiveStudent,
    isActiveYearDoc,
    filterDocsForActiveYear,
    normalizeSchoolYearState,
    yearScopeClauses,
} from "../utils/schoolYear.js";
import { cancelScheduledRenders, scheduleRender } from "../utils/renderScheduler.js";
import { getDeviceCacheChoice } from "../utils/deviceCache.js";

const PUBLIC_DATA_PATH = "artifacts/great-class-quest/public/data";
const OPEN_YEAR_CACHE_KEY = "gcq_open_school_years_v1";
const OPEN_YEAR_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
let activeListenerUserId = null;
let activeListenerIsSecretary = false;
let listenerSessionId = 0;
const featureListenerStarters = new Map();
const activeDataFeatures = new Set();

const featureListenerCleanups = new Map([
    ["assessments", () => {
        state.get("unsubscribeWrittenScores")();
        state.setUnsubscribeWrittenScores(() => {});
    }],
    ["attendance", () => {
        state.get("unsubscribeAttendance")();
        state.setUnsubscribeAttendance(() => {});
    }],
    ["guilds", () => {
        state.get("unsubscribeGuildScores")();
        state.get("unsubscribeGuildChampions")();
        state.get("unsubscribeFortuneWheelLog")();
        state.setUnsubscribeGuildScores(() => {});
        state.setUnsubscribeGuildChampions(() => {});
        state.setUnsubscribeFortuneWheelLog(() => {});
    }],
]);

function registerFeatureListener(feature, starter) {
    featureListenerStarters.set(feature, starter);
}
export function activateDataFeature(feature) {
    const key = String(feature || "");
    if (!key || activeDataFeatures.has(key)) return false;
    const starter = featureListenerStarters.get(key);
    if (typeof starter !== "function") return false;
    activeDataFeatures.add(key);
    starter();
    return true;
}

export function deactivateDataFeature(feature) {
    const key = String(feature || "");
    if (!key || !activeDataFeatures.has(key)) return false;
    featureListenerCleanups.get(key)?.();
    activeDataFeatures.delete(key);
    return true;
}

function onSnapshot(target, onNext, onError) {
    const sessionId = listenerSessionId;
    return firebaseOnSnapshot(target, (snapshot) => {
        if (sessionId === listenerSessionId) onNext(snapshot);
    }, (error) => {
        if (sessionId === listenerSessionId && typeof onError === "function") onError(error);
    });
}

function scheduleHomeRender() {
    const aboutTab = document.getElementById("about-tab");
    if (aboutTab?.classList.contains("hidden")) return;
    scheduleRender("home", renderHomeTab);
}

async function hydrateOpenSchoolYears(schoolYearState) {
    const ids = [...new Set([
        schoolYearState.activeYearKey,
        schoolYearState.nextYearKey,
    ].filter(Boolean))];
    if (!ids.length) {
        state.setAllSchoolYears([]);
        return;
    }

    if (getDeviceCacheChoice() === "trusted") {
        try {
            const cached = JSON.parse(localStorage.getItem(OPEN_YEAR_CACHE_KEY) || "null");
            if (cached?.savedAt && Date.now() - cached.savedAt < OPEN_YEAR_CACHE_TTL_MS && Array.isArray(cached.years)) {
                const cachedIds = new Set(cached.years.map((year) => year.id));
                if (ids.every((id) => cachedIds.has(id))) {
                    state.setAllSchoolYears(cached.years);
                    return;
                }
            }
        } catch (_) {
            // Browser cache is an optimization only.
        }
    }

    const snapshots = await Promise.all(ids.map((id) =>
        getDoc(doc(db, `${PUBLIC_DATA_PATH}/school_years`, id)),
    ));
    const years = snapshots
        .filter((snapshot) => snapshot.exists())
        .map((snapshot) => ({ id: snapshot.id, ...snapshot.data() }));
    state.setAllSchoolYears(years);
    if (getDeviceCacheChoice() === "trusted") {
        try {
            localStorage.setItem(OPEN_YEAR_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), years }));
        } catch (_) {
            // Quota/privacy mode should never block startup.
        }
    }
}

function resolveListenerYearContext() {
    const schoolYearState = normalizeSchoolYearState(state.get("schoolYearState"));
    const activeYearKey = schoolYearState.activeYearKey;
    const enforceActiveYearQueries = Boolean(activeYearKey);
    return {
        activeYearKey,
        enforceActiveYearQueries,
        includeUntagged: false,
    };
}

function buildCompletedStoriesQuery(yearContext) {
    const { activeYearKey, enforceActiveYearQueries } = yearContext;
    return query(
        collection(db, `${PUBLIC_DATA_PATH}/completed_stories`),
        ...yearScopeClauses(enforceActiveYearQueries, activeYearKey),
        orderBy("completedAt", "desc"),
        limit(100),
    );
}

function buildHeroChronicleNotesQuery(userId, isSecretary, yearContext) {
    const { activeYearKey, enforceActiveYearQueries } = yearContext;
    if (isSecretary) {
        return query(
            collection(db, `${PUBLIC_DATA_PATH}/hero_chronicle_notes`),
            ...yearScopeClauses(enforceActiveYearQueries, activeYearKey),
        );
    }
    return query(
        collection(db, `${PUBLIC_DATA_PATH}/hero_chronicle_notes`),
        ...yearScopeClauses(enforceActiveYearQueries, activeYearKey),
        where("teacherId", "==", userId),
    );
}

function buildShopItemsQuery(userId, isSecretary, yearContext) {
    const { activeYearKey, enforceActiveYearQueries } = yearContext;
    if (isSecretary) {
        return query(
            collection(db, `${PUBLIC_DATA_PATH}/shop_items`),
            ...yearScopeClauses(enforceActiveYearQueries, activeYearKey),
        );
    }
    return query(
        collection(db, `${PUBLIC_DATA_PATH}/shop_items`),
        ...yearScopeClauses(enforceActiveYearQueries, activeYearKey),
        where("teacherId", "==", userId),
    );
}

export function ensureCompletedStoriesListener() {
    if (state.get("hasLoadedCompletedStories")) return;
    const userId = activeListenerUserId || state.get("currentUserId");
    if (!userId) return;

    const yearContext = resolveListenerYearContext();
    const { activeYearKey, includeUntagged } = yearContext;

    state.setHasLoadedCompletedStories(true);
    state.setUnsubscribeCompletedStories(
        onSnapshot(
            buildCompletedStoriesQuery(yearContext),
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
}

export function ensureHeroChronicleNotesListener() {
    if (state.get("hasLoadedHeroChronicleNotes")) return;
    const userId = activeListenerUserId || state.get("currentUserId");
    if (!userId) return;

    const isSecretary =
        activeListenerIsSecretary || state.get("currentUserRole") === "secretary";
    const yearContext = resolveListenerYearContext();
    const { activeYearKey, includeUntagged } = yearContext;

    state.setHasLoadedHeroChronicleNotes(true);
    state.setUnsubscribeHeroChronicleNotes(
        onSnapshot(
            buildHeroChronicleNotesQuery(userId, isSecretary, yearContext),
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
}

export function ensureShopItemsListener() {
    if (state.get("hasLoadedShopItems")) return;
    const userId = activeListenerUserId || state.get("currentUserId");
    if (!userId) return;

    const isSecretary =
        activeListenerIsSecretary || state.get("currentUserRole") === "secretary";
    const yearContext = resolveListenerYearContext();
    const { activeYearKey, includeUntagged } = yearContext;

    state.setHasLoadedShopItems(true);
    state.setUnsubscribeShopItems(
        onSnapshot(
            buildShopItemsQuery(userId, isSecretary, yearContext),
            async (snapshot) => {
                state.setCurrentShopItems(
                    snapshot.docs
                        .map((d) => ({ id: d.id, ...d.data() }))
                        .filter((item) =>
                            isActiveYearDoc(item, activeYearKey, {
                                includeUntagged,
                            }),
                        ),
                );
                const shopModal = document.getElementById("shop-modal");
                const shopTab = document.getElementById("shop-tab");
                const shopVisible =
                    (shopModal && !shopModal.classList.contains("hidden")) ||
                    (shopTab && !shopTab.classList.contains("hidden"));
                if (shopVisible) {
                    const { renderShopUI } = await import("../ui/core/shop.js");
                    renderShopUI();
                }
            },
            (error) => console.error("Error listening to shop items:", error),
        ),
    );
}

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

export function clearDataListeners() {
    listenerSessionId += 1;
    cancelScheduledRenders();
    if (window.genderCheckTimeout) {
        clearTimeout(window.genderCheckTimeout);
        window.genderCheckTimeout = null;
    }
    activeListenerUserId = null;
    activeListenerIsSecretary = false;
    featureListenerStarters.clear();
    activeDataFeatures.clear();
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

if (typeof window !== "undefined" && !window.__GCQ_LISTENER_PAGE_LIFECYCLE__) {
    window.__GCQ_LISTENER_PAGE_LIFECYCLE__ = true;
    window.addEventListener("pagehide", clearDataListeners);
    window.addEventListener("pageshow", (event) => {
        // A page restored from the back-forward cache has intentionally detached
        // listeners. Reload once so it receives a fresh, single subscription set.
        if (event.persisted) window.location.reload();
    });
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
            state.setSchoolSettingsLoaded(true);
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
    clearDataListeners();
    activeListenerUserId = userId;
    activeListenerIsSecretary = isSecretary;
    const setupSessionId = listenerSessionId;
    let initialReadyFired = false;
    let classesReady = false;
    let schoolSettingsReady = false;
    let schoolYearReady = false;
    let openYearRegistryReady = false;

    // --- Performance helpers ---
    // Returns true only if a tab element is currently visible (not hidden).
    // This lets listeners skip re-rendering tabs the user isn't looking at;
    // showTab() already re-renders on navigation so nothing is missed.
    function isTabVisible(tabId) {
        return !document.getElementById(tabId)?.classList.contains("hidden");
    }

    function maybeFireInitialReady() {
        if (
            typeof onInitialDataReady === "function" &&
            !initialReadyFired &&
            classesReady &&
            schoolSettingsReady &&
            schoolYearReady &&
            openYearRegistryReady
        ) {
            initialReadyFired = true;
            onInitialDataReady();
        }
    }
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const schoolYearStateRef = doc(
        db,
        `${publicDataPath}/school_year_state`,
        "current",
    );
    const initialSchoolYearState = await new Promise((resolve) => {
        let initialSnapshotPending = true;
        state.setUnsubscribeSchoolYearState(
            onSnapshot(
                schoolYearStateRef,
                (snap) => {
                const prevState = normalizeSchoolYearState(
                    state.get("schoolYearState"),
                );
                const nextData = snap.exists() ? snap.data() : null;
                const nextState = normalizeSchoolYearState(nextData);
                state.setSchoolYearState(nextData);

                const yearScopeChanged =
                    prevState.activeYearKey !== nextState.activeYearKey ||
                    prevState.enforceActiveYearQueries !==
                        nextState.enforceActiveYearQueries;
                if (yearScopeChanged) {
                    state.setHasLoadedCalendarHistory(false);
                    state.setAllAwardLogs(
                        filterDocsForActiveYear(
                            state.get("allAwardLogs"),
                            nextState,
                        ),
                    );
                    if (isTabVisible("calendar-tab")) renderCalendarTab();
                }

                schoolYearReady = true;
                maybeFireInitialReady();
                scheduleHomeRender();
                const secretaryScreen = document.getElementById("secretary-screen");
                if (secretaryScreen && !secretaryScreen.classList.contains("hidden")) {
                    maybeRenderSecretaryPortal("admin");
                }
                if (initialSnapshotPending) {
                    initialSnapshotPending = false;
                    resolve(nextState);
                }
                },
                (error) => {
                console.error("Error listening to school year state:", error);
                schoolYearReady = true;
                maybeFireInitialReady();
                if (initialSnapshotPending) {
                    initialSnapshotPending = false;
                    resolve(normalizeSchoolYearState(null));
                }
                },
            ),
        );
    });
    if (setupSessionId !== listenerSessionId) return;

    const activeYearKey = initialSchoolYearState.activeYearKey;
    if (!activeYearKey) {
        const error = new Error(
            "The active school-year configuration is unavailable. GCQ has kept local data read-only and did not start year-scoped queries.",
        );
        error.code = "gcq/school-year-unavailable";
        if (typeof options.onInitializationError === "function") {
            options.onInitializationError(error);
        } else {
            console.error(error);
        }
        return;
    }
    // A known active year is mandatory here. Never fall back to collection-wide
    // startup reads, because that would re-download archived school years.
    const enforceActiveYearQueries = true;
    const includeUntagged = false;

    void hydrateOpenSchoolYears(initialSchoolYearState)
        .catch((error) => console.warn("Could not load active/planned school-year definitions:", error))
        .finally(() => {
            if (setupSessionId !== listenerSessionId) return;
            openYearRegistryReady = true;
            maybeFireInitialReady();
        });

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
        ? query(
              collection(db, `${publicDataPath}/quest_assignments`),
              ...yearScopeClauses(enforceActiveYearQueries, activeYearKey),
          )
        : query(
              collection(db, `${publicDataPath}/quest_assignments`),
              ...yearScopeClauses(enforceActiveYearQueries, activeYearKey),
              where("createdBy.uid", "==", userId),
          );
    const overridesQuery = enforceActiveYearQueries
        ? query(
              collection(db, `${publicDataPath}/schedule_overrides`),
              where("schoolYearKey", "==", activeYearKey),
          )
        : query(collection(db, `${publicDataPath}/schedule_overrides`));
    const questBountiesQuery = isSecretary
        ? query(
              collection(db, `${publicDataPath}/quest_bounties`),
              ...yearScopeClauses(enforceActiveYearQueries, activeYearKey),
          )
        : query(
              collection(db, `${publicDataPath}/quest_bounties`),
              ...yearScopeClauses(enforceActiveYearQueries, activeYearKey),
              where("createdBy.uid", "==", userId),
          );
    const schoolSettingsQuery = doc(
        db,
        `${publicDataPath}/school_settings`,
        "holidays",
    );
    const guildScoresQuery = enforceActiveYearQueries
        ? query(
              collection(db, `${publicDataPath}/guild_scores`),
              ...yearScopeClauses(
                  enforceActiveYearQueries,
                  activeYearKey,
                  "activeSchoolYearKey",
              ),
          )
        : query(collection(db, `${publicDataPath}/guild_scores`));

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
              ...yearScopeClauses(enforceActiveYearQueries, activeYearKey),
              where("createdAt", ">=", thirtyDaysAgo),
          )
        : query(
              collection(db, `${publicDataPath}/attendance`),
              ...yearScopeClauses(enforceActiveYearQueries, activeYearKey),
              where("markedBy.uid", "==", userId),
              where("createdAt", ">=", thirtyDaysAgo),
          );

    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    const threeMonthsAgoString = threeMonthsAgo.toISOString().split("T")[0];

    // orderBy("date","desc") is required so the secretary query uses the
    // schoolYearKey+date DESC composite index (range filters default to ASC).
    const writtenScoresQuery = isSecretary
        ? query(
              collection(db, `${publicDataPath}/written_scores`),
              ...yearScopeClauses(enforceActiveYearQueries, activeYearKey),
              where("date", ">=", threeMonthsAgoString),
              orderBy("date", "desc"),
          )
        : query(
              collection(db, `${publicDataPath}/written_scores`),
              ...yearScopeClauses(enforceActiveYearQueries, activeYearKey),
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
                scheduleHomeRender();
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
                scheduleHomeRender();
                if (isSecretary) {
                    maybeRenderSecretaryPortal("school");
                    maybeRenderSecretaryPortal("home");
                }
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
                snapshot.docChanges().forEach((change) => {
                    if (change.type === "added" || change.type === "modified") {
                        const scoreData = change.doc.data();
                        const studentId = change.doc.id;

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

                scheduleHomeRender();
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
                scheduleHomeRender();
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

    registerFeatureListener("assessments", () => state.setUnsubscribeWrittenScores(
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
                scheduleHomeRender();
                if (isSecretary) {
                    maybeRenderSecretaryPortal("grades");
                    maybeRenderSecretaryPortal("home");
                }
            },
            (error) => {
                console.error("Error listening to written scores:", error);
            },
        ),
    ));

    registerFeatureListener("attendance", () => state.setUnsubscribeAttendance(
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
    ));

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
                scheduleHomeRender();
            },
            (error) =>
                console.error("Error listening to schedule overrides:", error),
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
                scheduleHomeRender();
            },
            (error) =>
                console.error("Error listening to quest bounties:", error),
        ),
    );

    state.setUnsubscribeSchoolSettings(
        onSnapshot(schoolSettingsQuery, async (docSnapshot) => {
            state.setSchoolSettingsLoaded(true);
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
            scheduleHomeRender();
        }),
    );

    registerFeatureListener("guilds", () => {
    state.setUnsubscribeGuildScores(
        onSnapshot(
            guildScoresQuery,
            (snapshot) => {
                const allGuildScores = {};
                snapshot.docs.forEach((d) => {
                    allGuildScores[d.id] = { id: d.id, ...d.data() };
                });
                state.setAllGuildScores(allGuildScores);
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
    });

    if (isSecretary) {
        subscribeCommunicationThreads({ userId, isSecretary: true });
    }
}
