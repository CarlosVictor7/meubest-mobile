import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserProfile } from '@models/user';

interface AuthState {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  loading: boolean;
  /**
   * profileError: true quando o Firestore retornou erro ao ler o perfil.
   * Diferente de profile=null (que significa usuário genuinamente sem perfil).
   * NUNCA é persistido no AsyncStorage — reseta a cada restart do app.
   * Quando true, o RootNavigator mostra tela de erro em vez de ProfileForm.
   */
  profileError: boolean;
  // Actions
  setUser: (user: FirebaseUser | null) => void;
  setProfile: (profile: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  setProfileError: (error: boolean) => void;
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
      profileError: false,

      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setLoading: (loading) => set({ loading }),
      setProfileError: (profileError) => set({ profileError }),
      clear: () => set({ user: null, profile: null, loading: false, profileError: false }),

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
      // Não persistir loading, profileError nem o objeto FirebaseUser completo
      // profileError deve resetar a cada restart — o usuário pode tentar novamente
      partialize: (state) => ({
        profile: state.profile,
      }),
    }
  )
);
