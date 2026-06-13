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
  deleteField 
} from 'firebase/firestore';
import { auth, db } from '@shared/services/firebase';
import { useAuthStore } from '@shared/stores/authStore';
import type { UserProfile } from '@models/user';
import { 
  registerForPushNotificationsAsync, 
  registerNotificationResponseListener 
} from '@shared/services/notifications';

interface AuthContextValue {
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextValue>({ isInitialized: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setUser, setProfile, setLoading, clear, user, profile } = useAuthStore();
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

          if (firebaseUser) {
            setLoading(true);
            const profileRef = doc(db, 'users', firebaseUser.uid);

            unsubProfileRef.current = onSnapshot(
              profileRef,
              (snap) => {
                if (snap.exists()) {
                  setProfile(snap.data() as UserProfile);
                } else {
                  setProfile(null);
                }
                setLoading(false);
              },
              (error) => {
                console.error('[AuthProvider] Profile snapshot error:', error);
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

