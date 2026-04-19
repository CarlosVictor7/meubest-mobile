import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { appConfig } from '@constants/appConfig';

// Evita reinicializar em hot reload
const app = getApps().length === 0
  ? initializeApp(appConfig.firebase)
  : getApp();

// Firebase Auth com persistência via AsyncStorage
// Usa import dinâmico para compatibilidade com Firebase v12 + React Native
let _auth: ReturnType<typeof getAuth>;

if (getApps().length <= 1 && !getApps()[0]?.options?.projectId) {
  // Primeiro boot — inicializa com persistência
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getReactNativePersistence } = require('firebase/auth');
  _auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  _auth = getAuth(app);
}

export const auth = _auth;

// @ts-ignore — custom database ID
export const db = getFirestore(app, appConfig.firebase.firestoreDatabaseId);
export const storage = getStorage(app);

export default app;
