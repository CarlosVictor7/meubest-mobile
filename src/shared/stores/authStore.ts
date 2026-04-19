import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserProfile } from '@models/user';

interface AuthState {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  // Actions
  setUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  clear: () => void;
  // Computed
  isAdmin: () => boolean;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      profile: null,
      loading: false, // AuthProvider define como true ao iniciar e false após resolver

      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setLoading: (loading) => set({ loading }),
      clear: () => set({ user: null, profile: null, loading: false }),

      isAdmin: () => {
        const { profile, user } = get();
        const adminEmails = ['fillipelustman@gmail.com', 'fillipe.l@gmail.com'];
        return (
          profile?.role === 'admin' ||
          (user?.email != null && adminEmails.includes(user.email))
        );
      },
      isAuthenticated: () => get().user !== null,
    }),
    {
      name: 'meubest-auth',
      storage: createJSONStorage(() => AsyncStorage),
      // Não persistir loading nem o objeto FirebaseUser completo (não serializável)
      partialize: (state) => ({
        profile: state.profile,
      }),
    }
  )
);
