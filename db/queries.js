// /db/queries.js

import { db, collection, query, where, getDocs, orderBy } from '../firebase.js';
import { parseFlexibleDate, parseDDMMYYYY } from '../utils.js';

/**
 * CORRECTED: Fetches all award log entries for a specific date using a Timestamp query.
 * @param {string} dateString - The date in DD-MM-YYYY format.
 * @returns {Promise<Array>} A promise that resolves to an array of log documents.
 */
export async function fetchLogsForDate(dateString) {
    // 1. Convert the DD-MM-YYYY string to a proper Date object
    const day = parseDDMMYYYY(dateString);
    day.setHours(0, 0, 0, 0); // Start of the day

    // 2. Create the end boundary (start of the next day)
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);

    const publicDataPath = "artifacts/great-class-quest/public/data";
    // 3. Query using the 'createdAt' timestamp field
    const logsQuery = query(
        collection(db, `${publicDataPath}/award_log`),
        where("createdAt", ">=", day),
        where("createdAt", "<", nextDay)
    );
    
    try {
        const snapshot = await getDocs(logsQuery);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error("Error fetching logs for date:", error);
        return [];
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

/**
 * CORRECTED: Fetches all award log entries for a specific month using a Timestamp query.
 * @param {number} year 
 * @param {number} month (1-12)
 * @returns {Promise<Array>} A promise that resolves to an array of log documents.
 */
export async function fetchLogsForMonth(year, month) {
    // 1. Create proper Date objects for the start and end of the month
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1); // The start of the NEXT month

    const publicDataPath = "artifacts/great-class-quest/public/data";
    // 2. Query using the 'createdAt' timestamp field for a precise range
    const logsQuery = query(
        collection(db, `${publicDataPath}/award_log`),
        where("createdAt", ">=", startDate),
        where("createdAt", "<", endDate)
    );
    
    try {
        const snapshot = await getDocs(logsQuery);
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        if (error.code === 'failed-precondition') {
            console.error("Firestore query failed. Index needed for award_log on 'createdAt'. The console error message from Firebase should contain a link to create it automatically.", error);
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
            const dateObj = parseFlexibleDate(trial.date);
            if (dateObj) {
                const year = dateObj.getFullYear();
                const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                monthSet.add(`${year}-${month}`);
            }
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
