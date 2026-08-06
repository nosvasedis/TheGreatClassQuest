import { collection, db, getDocs, query, where, writeBatch } from '../firebase.js';

const PUBLIC_DATA_PATH = 'artifacts/great-class-quest/public/data';
let lastDailyCleanupKey = null;

/**
 * Lazily remove obsolete per-day scratch rows on the first daily star action.
 * Nothing invokes this during login or initial listener hydration.
 */
export async function cleanupPreviousDayStarsOnce(userId, todayDateString) {
    if (!userId || !todayDateString) return 0;
    const runKey = `${userId}:${todayDateString}`;
    if (lastDailyCleanupKey === runKey) return 0;
    lastDailyCleanupKey = runKey;
    try {
        const snapshot = await getDocs(query(
            collection(db, `${PUBLIC_DATA_PATH}/today_stars`),
            where('teacherId', '==', userId),
        ));
        const obsolete = snapshot.docs.filter((entry) => entry.data().date !== todayDateString);
        if (!obsolete.length) return 0;

        const batch = writeBatch(db);
        obsolete.forEach((entry) => batch.delete(entry.ref));
        await batch.commit();
        return obsolete.length;
    } catch (error) {
        lastDailyCleanupKey = null;
        throw error;
    }
}
