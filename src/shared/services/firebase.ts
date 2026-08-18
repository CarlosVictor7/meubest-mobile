import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore } from 'firebase/firestore';
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

const databaseId = appConfig.firebase.firestoreDatabaseId;

// ── Transporte do Firestore ──────────────────────────────────────
//
// Por padrão o SDK usa WebChannel (streaming HTTP de longa duração) e decide
// sozinho se precisa cair para long-polling — o `experimentalAutoDetectLongPolling`,
// ligado por default desde maio/2023.
//
// Essa auto-detecção foi projetada para BROWSER. Em React Native (Hermes) ela
// inspeciona a resposta do XHR de sondagem para decidir, e o comportamento
// diferente do fetch/XHR do RN faz a detecção errar. Quando erra, o stream
// nunca completa o handshake e o resultado é exatamente o erro que víamos:
//
//   "Could not reach Cloud Firestore backend. Backend didn't respond within
//    10 seconds. [...] The client will operate in offline mode"
//
// — com a rede do aparelho perfeitamente funcional. O sintoma engana porque o
// SDK reporta como "offline" aquilo que na verdade é falha de transporte.
//
// `experimentalForceLongPolling` pula a detecção e usa long-polling direto.
// É o modo mais tolerante a proxy, NAT do emulador e antivírus que bufferizam
// tráfego. Custo: um pouco mais de latência por atualização, em troca de
// conexão que estabelece de forma confiável.
//
// ⚠️ Não pode ser combinado com `experimentalAutoDetectLongPolling` — o SDK
//    lança erro se as duas forem definidas.
//
// Este app é RN puro (não há build web neste repositório), então forçar é
// seguro. Para reverter, basta trocar a constante abaixo para `false`.
const FORCE_LONG_POLLING = true;

// `initializeFirestore` só pode ser chamado uma vez por app; em hot reload
// (isFirstInit=false) a instância já existe e precisa vir de `getFirestore`.
export const db = isFirstInit
  ? initializeFirestore(
      app,
      { experimentalForceLongPolling: FORCE_LONG_POLLING },
      databaseId
    )
  : getFirestore(app, databaseId);

export const storage = getStorage(app);

export default app;
