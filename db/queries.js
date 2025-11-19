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
        if (error.code === 'failed-precondition') {
            console.error("Firestore query failed. Index needed for award_log date range.", error);
        } else {
            console.error("Error fetching logs for month:", error);
        }
        return [];
    }
}

// --- NEW: Attendance Fetching ---

/**
 * Fetches attendance records for a specific class and month based on creation time.
 * @param {string} classId 
 * @param {number} year 
 * @param {number} month (1-12)
 */
export async function fetchAttendanceForMonth(classId, year, month) {
    const startDate = new Date(year, month - 1, 1); 
    const endDate = new Date(year, month, 0, 23, 59, 59); 

    const publicDataPath = "artifacts/great-class-quest/public/data";
    // We use createdAt for range querying because the 'date' field is a DD-MM-YYYY string 
    // which doesn't sort chronologically in Firestore.
    const attendanceQuery = query(
        collection(db, `${publicDataPath}/attendance`),
        where("classId", "==", classId),
        where("createdAt", ">=", startDate),
        where("createdAt", "<=", endDate)
    );

    try {
        const snapshot = await getDocs(attendanceQuery);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching attendance for month:", error);
        if (error.code === 'failed-precondition') {
             alert("Database Setup: A composite index is required for Attendance queries (classId + createdAt). Open console for link.");
        }
        return [];
    }
}

// --- TRIAL HISTORY FUNCTIONS ---

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

export async function fetchTrialsForMonth(classId, monthKey) {
    const startDate = new Date(monthKey + '-01');
    const endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);

    const startDateString = startDate.toISOString().split('T')[0]; 
    const endDateString = endDate.toISOString().split('T')[0];     

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
        return [];
    }
}
