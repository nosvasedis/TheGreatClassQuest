// utils/firestoreCacheEpoch.mjs — throws away this browser's offline copy of the database once,
// whenever FIRESTORE_DATA_EPOCH (constants.js) changes. Used when the database itself is
// replaced (tools/DATA_MOVE_TO_EUROPE.md): the copy is downloaded fresh instead of being matched
// against a database that no longer exists.
//
// It must run before Firestore starts (firebase.js). The browser runs a pending delete of a
// database before any later open of the same name, so the SDK always opens an empty cache.
// Only devices that keep data offline ("Keep this device fast") have such a copy.

export const FIRESTORE_EPOCH_STORAGE_KEY = 'gcq.firestoreDataEpoch';

// The name the Firestore SDK gives its offline database for the default app and database.
export function firestoreCacheDbName(projectId, appName = '[DEFAULT]') {
    return `firestore/${appName}/${projectId}/main`;
}

/**
 * @returns {boolean} true when an old copy was scheduled for deletion.
 */
export function resetFirestoreCacheIfEpochChanged({ projectId, epoch, storage, idb } = {}) {
    try {
        if (!projectId || !epoch || !storage || !idb) return false;
        if (storage.getItem(FIRESTORE_EPOCH_STORAGE_KEY) === epoch) return false;
        idb.deleteDatabase(firestoreCacheDbName(projectId));
        storage.setItem(FIRESTORE_EPOCH_STORAGE_KEY, epoch);
        return true;
    } catch {
        // Private windows and blocked storage: there is no offline copy to worry about.
        return false;
    }
}
