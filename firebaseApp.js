import { getApp, getApps, initializeApp } from 'firebase/app';
import { firebaseConfig } from './constants.js';

// Keep one Firebase app instance even when feature chunks are loaded concurrently.
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

