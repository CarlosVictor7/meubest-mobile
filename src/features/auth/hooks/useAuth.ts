import { useAuthStore } from '@shared/stores/authStore';
import { signOut } from 'firebase/auth';
import { auth, db } from '@shared/services/firebase';
import { doc, updateDoc, deleteField } from 'firebase/firestore';

/** Hook conveniente para acessar auth state — padrão igual à web */
export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const profile = useAuthStore((s) => s.profile);
  const loading = useAuthStore((s) => s.loading);
  const isAdmin = useAuthStore((s) => s.isAdmin());
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated());

  const logout = async () => {
    try {
      if (user) {
        // Limpa as credenciais de push no banco antes do signOut
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, {
          pushToken: deleteField(),
          pushTokenPlatform: deleteField(),
          pushTokenUpdatedAt: deleteField(),
        }).catch((e) => {
          console.warn('[useAuth] Falha ao limpar push token no Firestore durante logout:', e);
        });
      }
      await signOut(auth);
      useAuthStore.getState().clear();
    } catch (error) {
      console.error('[useAuth] Logout error:', error);
      throw error;
    }
  };

  return { user, profile, loading, isAdmin, isAuthenticated, logout };
}
