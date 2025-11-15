// /db/queries.js

import { db, collection, query, where, getDocs, orderBy } from '../firebase.js';

/**
 * Fetches all award log entries for a specific date from Firestore.
 * Used for viewing historical data in the Logbook modal.
 * @param {string} dateString - The date in DD-MM-YYYY format.
 * @returns {Promise<Array>} A promise that resolves to an array of log documents.
 */
export async function fetchLogsForDate(dateString) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const logsQuery = query(
        collection(db, `${publicDataPath}/award_log`),
        where("date", "==", dateString)
    );
    
    try {
        const snapshot = await getDocs(logsQuery);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching logs for date:", error);
        return []; // Return empty array on error
    }
}

/**
 * Fetches all written score (trial) documents for a specific class from Firestore.
 * This is used to get a list of all historical months with data.
 * @param {string} classId - The ID of the class to fetch trials for.
 * @returns {Promise<Array>} A promise that resolves to an array of score documents.
 */
export async function fetchAllTrialsForClass(classId) {
    const publicDataPath = "artifacts/great-class-quest/public/data";
    const trialsQuery = query(
        collection(db, `${publicDataPath}/written_scores`),
        where("classId", "==", classId),
        orderBy("date", "desc")
    );
    
    try {
        const snapshot = await getDocs(trialsQuery);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching all trials for class:", error);
        return [];
    }

}

export async function fetchLogsForMonth(year, month) {
    // Firestore queries don't support "month/year" directly.
    // We create start and end date strings for the query.
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Day 0 of next month is the last day of current month

    const startDateString = `${String(startDate.getDate()).padStart(2, '0')}-${String(startDate.getMonth() + 1).padStart(2, '0')}-${startDate.getFullYear()}`;
    const endDateString = `${String(endDate.getDate()).padStart(2, '0')}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${endDate.getFullYear()}`;

    const publicDataPath = "artifacts/great-class-quest/public/data";
    const logsQuery = query(
        collection(db, `${publicDataPath}/award_log`),
        where("date", ">=", startDateString),
        where("date", "<=", endDateString)
    );
    
    try {
        const snapshot = await getDocs(logsQuery);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        // This error will happen if the index is not created yet.
        if (error.code === 'failed-precondition') {
            console.error("Firestore query failed. You likely need to create a composite index for 'award_log' on the 'date' field. The error message below should contain a link to create it.", error);
            alert("A one-time database setup is required. Please open the browser console (F12) to find a link to create a necessary database index for this feature.");
        } else {
            console.error("Error fetching logs for month:", error);
        }
        return [];
    }
}

// --- NEW FUNCTIONS FOR ON-DEMAND TRIAL HISTORY ---

/**
 * Fetches all trial documents for a class to determine which months have data.
 * @param {string} classId - The ID of the class.
 * @returns {Promise<Set<string>>} A promise that resolves to a Set of unique month keys (YYYY-MM).
 */
export async function fetchAllTrialMonthsForClass(classId) {
    const allTrials = await fetchAllTrialsForClass(classId);
    const monthSet = new Set();
    allTrials.forEach(trial => {
        if (trial.date) {
            monthSet.add(trial.date.substring(0, 7)); // Extracts YYYY-MM
        }
    });
    return monthSet;
}

/**
 * Fetches all trial documents for a specific class and month.
 * @param {string} classId - The ID of the class.
 * @param {string} monthKey - The month to fetch in YYYY-MM format.
 * @returns {Promise<Array>} A promise that resolves to an array of trial documents.
 */
export async function fetchTrialsForMonth(classId, monthKey) {
    const startDate = new Date(monthKey + '-01');
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

    const startDateString = startDate.toISOString().split('T')[0]; // YYYY-MM-DD
    const endDateString = endDate.toISOString().split('T')[0];     // YYYY-MM-DD

    const publicDataPath = "artifacts/great-class-quest/public/data";
    const trialsQuery = query(
        collection(db, `${publicDataPath}/written_scores`),
        where("classId", "==", classId),
        where("date", ">=", startDateString),
        where("date", "<=", endDateString),
        orderBy("date", "desc")
    );
    
    try {
        const snapshot = await getDocs(trialsQuery);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error(`Error fetching trials for month ${monthKey}:`, error);
        if (error.code === 'failed-precondition') {
             alert("A one-time database setup is required for this feature. Please open the browser console (F12) to find a link to create the necessary database index.");
        }
        return [];
    }
}
