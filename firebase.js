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
    setLogLevel,
    increment,
    runTransaction,
    collectionGroup,
    documentId,
    orderBy,
    limit
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

import { firebaseConfig } from './constants.js';

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
setLogLevel('error');

// Export the initialized services and all the Firestore functions
export {
    app,
    auth,
    db,
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
    limit
};
