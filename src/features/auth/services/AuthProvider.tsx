import React, { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { Platform } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import {
  doc,
  onSnapshot,
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  writeBatch,
  deleteField,
} from 'firebase/firestore';
import { auth, db } from '@shared/services/firebase';
import { useAuthStore } from '@shared/stores/authStore';
import type { UserProfile } from '@models/user';
import {
  registerForPushNotificationsAsync,
  registerNotificationResponseListener,
} from '@shared/services/notifications';

interface AuthContextValue {
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextValue>({ isInitialized: false });

/**
 * Códigos de erro do Firestore que indicam falha transitória de infraestrutura.
 * Nesses casos o usuário pode existir — não tratamos como "sem perfil".
 */
const FIRESTORE_TRANSIENT_ERROR_CODES = new Set([
  'resource-exhausted',   // quota esgotada
  'unavailable',          // serviço temporariamente indisponível
  'deadline-exceeded',    // timeout
  'internal',             // erro interno do Firebase
  'permission-denied',    // pode ser regra temporária/misconfiguration
  'unauthenticated',      // token expirou entre snapshot e resposta
]);

function isTransientFirestoreError(error: any): boolean {
  const code: string | undefined = error?.code;
  if (!code) return false;
  // Firebase retorna 'firestore/resource-exhausted' ou apenas 'resource-exhausted'
  const shortCode = code.includes('/') ? code.split('/').pop()! : code;
  return FIRESTORE_TRANSIENT_ERROR_CODES.has(shortCode);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setUser, setProfile, setLoading, setProfileError, clear, user, profile } =
    useAuthStore();
  const unsubProfileRef = useRef<(() => void) | null>(null);

  // ── Registra e sincroniza o Expo Push Token no Firestore ──────────
  useEffect(() => {
    if (!user || !profile) return;

    const setupNotifications = async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (!token) return;

        // Se o token já estiver atualizado, não faz nada
        if (profile.pushToken === token && profile.pushTokenPlatform === Platform.OS) {
          return;
        }

        console.log('[PushRegistration] Novo token detectado:', token);

        // 1. Unicidade: remove este token de qualquer outro usuário no Firestore
        const usersRef = collection(db, 'users');
        const q = query(usersRef, where('pushToken', '==', token));
        const snap = await getDocs(q);

        const batch = writeBatch(db);
        let hasUpdates = false;

        snap.docs.forEach((docSnap) => {
          if (docSnap.id !== user.uid) {
            console.log(`[PushRegistration] Removendo token duplicado do usuário: ${docSnap.id}`);
            batch.update(docSnap.ref, {
              pushToken: deleteField(),
              pushTokenPlatform: deleteField(),
              pushTokenUpdatedAt: deleteField(),
            });
            hasUpdates = true;
          }
        });

        if (hasUpdates) {
          await batch.commit();
        }

        // 2. Salvar token no usuário atual
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          pushToken: token,
          pushTokenPlatform: Platform.OS,
          pushTokenUpdatedAt: new Date().toISOString(),
        });

        console.log('[PushRegistration] Token salvo no Firestore.');
      } catch (error) {
        console.error('[PushRegistration] Erro ao registrar push token:', error);
      }
    };

    setupNotifications();
  }, [user?.uid, profile?.pushToken, profile?.pushTokenPlatform]);

  // ── Listener de cliques em notificações (toque) ────────────────────
  useEffect(() => {
    const sub = registerNotificationResponseListener();
    return () => {
      if (sub) sub.remove();
    };
  }, []);

  useEffect(() => {
    // Safety timeout: se Firebase não responder em 5s (ex: credenciais inválidas),
    // resolve o loading para false para o app não travar na tela de carregamento.
    const safetyTimeout = setTimeout(() => {
      console.warn('[AuthProvider] Firebase timeout — running in demo/offline mode');
      setLoading(false);
    }, 5000);

    let unsubAuth: (() => void) | null = null;

    try {
      unsubAuth = onAuthStateChanged(
        auth,
        async (firebaseUser) => {
          clearTimeout(safetyTimeout);

          // Cleanup previous profile listener
          if (unsubProfileRef.current) {
            unsubProfileRef.current();
            unsubProfileRef.current = null;
          }

          setUser(firebaseUser);
          // Ao trocar de usuário, limpa qualquer erro de perfil anterior
          setProfileError(false);

          if (firebaseUser) {
            setLoading(true);
            const profileRef = doc(db, 'users', firebaseUser.uid);

            unsubProfileRef.current = onSnapshot(
              profileRef,
              (snap) => {
                if (snap.exists()) {
                  // Perfil encontrado — limpa qualquer erro anterior e carrega dados
                  setProfileError(false);
                  setProfile(snap.data() as UserProfile);
                } else {
                  // doc.exists() === false: usuário genuinamente sem perfil.
                  // SOMENTE aqui é seguro setar profile=null e redirecionar para ProfileForm.
                  console.log('[AuthProvider] Perfil não encontrado para UID:', firebaseUser.uid);
                  setProfileError(false);
                  setProfile(null);
                }
                setLoading(false);
              },
              (error) => {
                console.error('[AuthProvider] Profile snapshot error:', error);

                if (isTransientFirestoreError(error)) {
                  // Erro transitório de infraestrutura: usuário pode existir.
                  // NÃO seta profile=null — isso evitaria incorretamente o cadastro.
                  // O RootNavigator mostrará tela de erro "Tente novamente".
                  console.warn(
                    '[AuthProvider] Erro transitório de Firestore — mantendo sessão. Code:',
                    error?.code
                  );
                  setProfileError(true);
                } else {
                  // Erro irrecuperável/desconhecido — limpa o estado
                  console.error('[AuthProvider] Erro irrecuperável de Firestore:', error?.code);
                  setProfile(null);
                  setProfileError(false);
                }
                setLoading(false);
              }
            );
          } else {
            clear();
          }
        },
        (error) => {
          clearTimeout(safetyTimeout);
          console.error('[AuthProvider] onAuthStateChanged error:', error);
          setLoading(false);
        }
      );
    } catch (error) {
      clearTimeout(safetyTimeout);
      console.error('[AuthProvider] Firebase init error (demo mode):', error);
      setLoading(false);
    }

    return () => {
      clearTimeout(safetyTimeout);
      if (unsubAuth) unsubAuth();
      if (unsubProfileRef.current) unsubProfileRef.current();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ isInitialized: true }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuthContext = () => useContext(AuthContext);
