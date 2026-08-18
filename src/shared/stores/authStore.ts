import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserProfile } from '@models/user';

interface AuthState {
  user: FirebaseUser | null;
  profile: UserProfile | null;
  /**
   * true enquanto ainda não sabemos se há sessão.
   *
   * Nasce `true` DE PROPÓSITO. Se nascesse `false`, o primeiro frame teria
   * `loading=false` e `isAuthenticated()=false` (porque `user` não é persistido),
   * e o RootNavigator montaria o fluxo de login antes de o Firebase ter dito
   * qualquer coisa — o flash de onboarding que o usuário via.
   *
   * O AuthProvider resolve para `false` quando o primeiro onAuthStateChanged
   * chega, ou quando o safetyTimeout dispara.
   */
  loading: boolean;
  /**
   * true depois que o `persist` terminou de ler o AsyncStorage.
   *
   * A hidratação é assíncrona: existe um intervalo entre o primeiro render e a
   * chegada do `profile` salvo. Sem este flag, esse intervalo é indistinguível
   * de "usuário sem perfil".
   */
  hasHydrated: boolean;
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
  setHasHydrated: (hydrated: boolean) => void;
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
      loading: true,
      hasHydrated: false,
      profileError: false,

      setUser: (user) => set({ user }),
      setProfile: (profile) => set({ profile }),
      setLoading: (loading) => set({ loading }),
      setHasHydrated: (hasHydrated) => set({ hasHydrated }),
      setProfileError: (profileError) => set({ profileError }),
      // `hasHydrated` não é resetado: uma vez hidratado, sempre hidratado.
      // Zerá-lo no logout mandaria o app de volta ao splash sem necessidade.
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
      // Não persistir loading, hasHydrated, profileError nem o objeto FirebaseUser completo.
      // profileError deve resetar a cada restart — o usuário pode tentar novamente.
      partialize: (state) => ({
        profile: state.profile,
      }),
      /**
       * Marca a hidratação como concluída — inclusive quando falha.
       * Um AsyncStorage inacessível não pode travar o app no splash para sempre:
       * seguimos sem o perfil em cache e deixamos o Firebase decidir.
       */
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.warn('[authStore] Falha ao hidratar do AsyncStorage:', error);
        }
        useAuthStore.getState().setHasHydrated(true);
      },
    }
  )
);
