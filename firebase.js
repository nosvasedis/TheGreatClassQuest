import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    updateProfile,
    signOut
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { 
    getFirestore, 
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
    runTransaction,
    collectionGroup,
    documentId,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
// NEW: Import Storage functions
import { 
    getStorage, 
    ref, 
    uploadString, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-storage.js";

import { firebaseConfig } from './constants.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
// NEW: Initialize Storage
const storage = getStorage(app);

// Export the initialized services and functions
export {
    app,
    auth,
    db,
    storage, // NEW: Export storage
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
    runTransaction,
    collectionGroup,
    documentId,
    orderBy,
    limit,
    // NEW: Storage functions
    ref,
    uploadString,
    getDownloadURL
};
