import { useAuthStore } from '@shared/stores/authStore';
import { signOut } from 'firebase/auth';
import { auth, db } from '@shared/services/firebase';
import { doc, updateDoc, deleteField, deleteDoc } from 'firebase/firestore';

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

  const deleteAccount = async () => {
    try {
      if (!user) throw new Error('Usuário não autenticado');

      const lastSignIn = auth.currentUser?.metadata.lastSignInTime;
      const diffMs = lastSignIn ? (Date.now() - new Date(lastSignIn).getTime()) : Infinity;
      
      // Se o login foi há mais de 5 minutos, a exclusão da conta do Firebase Auth quase certamente falhará com requires-recent-login.
      // Paramos antes de apagar o Firestore para não deixar a conta sem perfil mas ainda ativa.
      if (diffMs > 5 * 60 * 1000) {
        const err = new Error('Reautenticação necessária');
        (err as any).code = 'auth/requires-recent-login';
        throw err;
      }

      // 1. Excluir o documento principal do usuário no Firestore (apaga perfil, disponibilidade, status)
      const userRef = doc(db, 'users', user.uid);
      await deleteDoc(userRef);

      // 2. Excluir a credencial do usuário no Firebase Auth
      if (auth.currentUser) {
        await auth.currentUser.delete();
      }

      // 3. Limpar a sessão local do Zustand
      useAuthStore.getState().clear();
    } catch (error) {
      console.error('[useAuth] deleteAccount error:', error);
      throw error;
    }
  };

  return { user, profile, loading, isAdmin, isAuthenticated, logout, deleteAccount };
}

