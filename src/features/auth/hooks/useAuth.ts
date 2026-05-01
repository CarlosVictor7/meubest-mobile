import { useAuthStore } from '@shared/stores/authStore';
import { signOut } from 'firebase/auth';
import { auth } from '@shared/services/firebase';

/** Hook conveniente para acessar auth state — padrão igual à web */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const loading = useAuthStore((s) => s.loading);
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  const logout = async () => {
    try {
      await signOut(auth);
      useAuthStore.getState().clear();
    } catch (error) {
      console.error('[useAuth] Logout error:', error);
      throw error;
    }
  };

  return { user, profile, loading, isAdmin, isAuthenticated, logout };
}
