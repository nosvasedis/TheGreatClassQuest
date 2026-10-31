// /db/actions/history.js — loads the last 30 days of award_log on demand (Calendar, Weekly Report).
// Moved here from the legacy db/actions.js facade (2026-10-31); behaviour unchanged.
import * as state from '../../state.js';
import { filterDocsForActiveYear, normalizeSchoolYearState, yearScopeClauses, isActiveYearDoc } from '../../utils/schoolYear.js';
import { PUBLIC_DATA_PATH } from '../../utils/tenant.mjs';

export async function ensureHistoryLoaded() {
    if (state.get('hasLoadedCalendarHistory')) return;

    const loader = document.getElementById('calendar-loader');
    if (loader) loader.classList.remove('hidden');

    const { getDocs, query, collection: firestoreCollection, where, db: firestoreDb } = await import('../../firebase.js');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const publicDataPath = PUBLIC_DATA_PATH;
    const schoolYearState = normalizeSchoolYearState(state.get('schoolYearState'));
    const activeYearKey = schoolYearState.activeYearKey;
    const enforceActiveYearQueries = schoolYearState.enforceActiveYearQueries === true;
    const includeUntagged = !enforceActiveYearQueries;

    const q = query(
        firestoreCollection(firestoreDb, `${publicDataPath}/award_log`),
        ...yearScopeClauses(enforceActiveYearQueries, activeYearKey),
        where('createdAt', '>=', thirtyDaysAgo)
    );

    try {
        const snapshot = await getDocs(q);
        const historyLogs = snapshot.docs
            .map(d => ({ id: d.id, ...d.data() }))
            .filter((log) => isActiveYearDoc(log, activeYearKey, { includeUntagged }));

        const currentLogs = filterDocsForActiveYear(state.get('allAwardLogs'), schoolYearState);
        const logMap = new Map();

        historyLogs.forEach(log => logMap.set(log.id, log));
        currentLogs.forEach(log => logMap.set(log.id, log));

        const mergedLogs = filterDocsForActiveYear(Array.from(logMap.values()), schoolYearState);

        state.setAllAwardLogs(mergedLogs);
        state.setHasLoadedCalendarHistory(true);

    } catch (e) {
        console.error("Error loading history:", e);
    } finally {
        if (loader) loader.classList.add('hidden');
    }
}
