import { app } from './firebaseApp.js';
import {
    auth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    updateProfile,
    signOut
} from './firebaseAuth.js';
import {
    initializeFirestore,
    memoryLocalCache,
    persistentLocalCache,
    persistentMultipleTabManager,
    getPersistentCacheIndexManager,
    enablePersistentCacheIndexAutoCreation,
    doc, 
    setDoc as firestoreSetDoc,
    addDoc as firestoreAddDoc,
    getDoc as firestoreGetDoc,
    getDocs as firestoreGetDocs,
    deleteDoc as firestoreDeleteDoc,
    updateDoc as firestoreUpdateDoc,
    collection, 
    query, 
    where, 
    onSnapshot as firestoreOnSnapshot,
    serverTimestamp,
    writeBatch as firestoreWriteBatch,
    increment,
    arrayUnion,
    deleteField,
    runTransaction as firestoreRunTransaction,
    collectionGroup,
    documentId,
    orderBy,
    limit
} from "firebase/firestore";
// NEW: Import Storage functions
import { 
    getStorage, 
    ref, 
    uploadString, 
    getDownloadURL
} from "firebase/storage";
import {
    getFunctions,
    httpsCallable
} from "firebase/functions";

import { FIREBASE_FUNCTIONS_REGION } from './constants.js';
import { getDeviceCacheChoice } from './utils/deviceCache.js';
import { recordMetric } from './utils/runtimeMetrics.js';

const usePersistentCache = getDeviceCacheChoice() === 'trusted';
const db = initializeFirestore(app, {
    localCache: usePersistentCache
        ? persistentLocalCache({ tabManager: persistentMultipleTabManager() })
        : memoryLocalCache()
});

if (usePersistentCache) {
    try {
        const indexManager = getPersistentCacheIndexManager(db);
        if (indexManager) enablePersistentCacheIndexAutoCreation(indexManager);
    } catch (error) {
        console.warn('Firestore local query indexes are unavailable in this browser:', error);
    }
}
// NEW: Initialize Storage
const storage = getStorage(app);
const functions = getFunctions(app, FIREBASE_FUNCTIONS_REGION);

function countDelivered(snapshot) {
    if (Array.isArray(snapshot?.docs)) return snapshot.docs.length;
    return snapshot?.exists?.() ? 1 : 0;
}

function getDoc(...args) {
    recordMetric('queriesStarted');
    return firestoreGetDoc(...args).then((snapshot) => {
        recordMetric('documentsDelivered', countDelivered(snapshot));
        return snapshot;
    });
}

function getDocs(...args) {
    recordMetric('queriesStarted');
    return firestoreGetDocs(...args).then((snapshot) => {
        recordMetric('documentsDelivered', countDelivered(snapshot));
        return snapshot;
    });
}

function onSnapshot(target, onNext, onError, onCompletion) {
    recordMetric('queriesStarted');
    recordMetric('listenersAttached');
    const unsubscribe = firestoreOnSnapshot(target, (snapshot) => {
        recordMetric('documentsDelivered', countDelivered(snapshot));
        onNext(snapshot);
    }, onError, onCompletion);
    let detached = false;
    return () => {
        if (detached) return;
        detached = true;
        recordMetric('listenersDetached');
        unsubscribe();
    };
}

function setDoc(...args) {
    recordMetric('writesAttempted');
    return firestoreSetDoc(...args);
}

function addDoc(...args) {
    recordMetric('writesAttempted');
    return firestoreAddDoc(...args);
}

function updateDoc(...args) {
    recordMetric('writesAttempted');
    return firestoreUpdateDoc(...args);
}

function deleteDoc(...args) {
    recordMetric('writesAttempted');
    return firestoreDeleteDoc(...args);
}

function writeBatch(...args) {
    const batch = firestoreWriteBatch(...args);
    for (const method of ['set', 'update', 'delete']) {
        const original = batch[method].bind(batch);
        batch[method] = (...methodArgs) => {
            recordMetric('writesAttempted');
            return original(...methodArgs);
        };
    }
    return batch;
}

function runTransaction(...args) {
    recordMetric('writesAttempted');
    return firestoreRunTransaction(...args);
}

// Export the initialized services and functions
export {
    app,
    auth,
    db,
    storage, // NEW: Export storage
    functions,
    // Auth functions
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    updateProfile,
    signOut,
    // Firestore functions
    doc,
    setDoc,
    addDoc,
    getDoc,
    getDocs,
    deleteDoc,
    updateDoc,
    collection,
    query,
    where,
    onSnapshot,
    serverTimestamp,
    writeBatch,
    increment,
    arrayUnion,
    deleteField,
    runTransaction,
    collectionGroup,
    documentId,
    orderBy,
    limit,
    // NEW: Storage functions
    ref,
    uploadString,
    getDownloadURL
    ,
    // Functions
    httpsCallable
};
