import React, { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@shared/services/firebase';
import { useAuthStore } from '@shared/stores/authStore';
import type { UserProfile } from '@models/user';

interface AuthContextValue {
  isInitialized: boolean;
}

const AuthContext = createContext<AuthContextValue>({ isInitialized: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const { setUser, setProfile, setLoading, clear } = useAuthStore();
  const unsubProfileRef = useRef<(() => void) | null>(null);

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

