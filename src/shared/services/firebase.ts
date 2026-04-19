import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { appConfig } from '@constants/appConfig';

// Evita reinicializar em hot reload
const app = getApps().length === 0
  ? initializeApp(appConfig.firebase)
  : getApp();

export const auth = getAuth(app);
// @ts-ignore — custom database ID
export const db = getFirestore(app, appConfig.firebase.firestoreDatabaseId);
export const storage = getStorage(app);

export default app;
