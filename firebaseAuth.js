import {
    createUserWithEmailAndPassword,
    EmailAuthProvider,
    getAuth,
    onAuthStateChanged,
    reauthenticateWithCredential,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
} from 'firebase/auth';
import { app } from './firebaseApp.js';

export const auth = getAuth(app);
export {
    createUserWithEmailAndPassword,
    EmailAuthProvider,
    onAuthStateChanged,
    reauthenticateWithCredential,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signOut,
    updateProfile
};
