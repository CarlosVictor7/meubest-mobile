import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { appConfig } from '@constants/appConfig';

// Verifica ANTES de inicializar para detectar primeiro boot vs hot reload
const isFirstInit = getApps().length === 0;

const app = isFirstInit ? initializeApp(appConfig.firebase) : getApp();

// ── Firebase Auth com persistência AsyncStorage ──────────────────
// Usa require() para evitar erro de tipo com getReactNativePersistence no SDK 12
// Ref: https://firebase.google.com/docs/auth/web/auth-state-persistence
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { initializeAuth, getAuth, getReactNativePersistence } = require('firebase/auth');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const AsyncStorage = require('@react-native-async-storage/async-storage').default;

// isFirstInit garante que initializeAuth só é chamado uma vez
// Em hot reload (isFirstInit=false), reutiliza a instância existente via getAuth
export const auth = isFirstInit
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

// @ts-ignore — custom Firestore database ID
export const db = getFirestore(app, appConfig.firebase.firestoreDatabaseId);
export const storage = getStorage(app);

export default app;
