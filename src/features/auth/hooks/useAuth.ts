import { useAuthStore } from '@shared/stores/authStore';
import { signOut } from 'firebase/auth';
import { auth, db } from '@shared/services/firebase';
import { doc, updateDoc, deleteField, deleteDoc } from 'firebase/firestore';
import { runLogoutCleanup } from '../utils/logoutCleanup';
import { appConfig } from '@constants/appConfig';
import { clearPendingNotificationRoute } from '../../../navigation/notificationNavigation';
import { useUserSessionsStore } from '@features/session/stores/userSessionsStore';

/**
 * `DELETE {apiUrl}/me/photos` com Bearer idToken. Best-effort: qualquer falha
 * (sem rede, API fora, 4xx/5xx) é apenas logada. `fetch` direto de propósito —
 * é a única chamada que precisa sobreviver ao fluxo de exclusão da conta.
 */
async function deleteRemotePhotosBestEffort(): Promise<void> {
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return;
    const response = await fetch(`${appConfig.apiUrl}/me/photos`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!response.ok) {
      console.warn(`[useAuth] DELETE /me/photos respondeu ${response.status} (seguindo com a exclusão)`);
    }
  } catch (error) {
    console.warn('[useAuth] DELETE /me/photos falhou (seguindo com a exclusão):', error);
  }
}

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
        // Limpeza CRÍTICA antes do signOut: derruba a presença e desassocia o
        // push token. A ordem importa — depois do signOut as Rules negariam a
        // escrita (isOwner falha) e a conta ficaria "online" para sempre.
        //
        // A falha aqui NÃO é mais engolida: com retry esgotado, o logout
        // falha visivelmente e o estado permanece coerente. Sair da conta
        // deixando a push ativa é pior do que pedir para tentar de novo.
        // A agenda (`availability`) NÃO é tocada: ela vale para o próximo login.
        const userRef = doc(db, 'users', user.uid);
        await runLogoutCleanup(async () => {
          await updateDoc(userRef, {
            isOnline: false,
            lastSeenAt: new Date().toISOString(),
            pushToken: deleteField(),
            pushTokenPlatform: deleteField(),
            pushTokenUpdatedAt: deleteField(),
          });
        });
      }
      // Intenção de navegação de push pendente morre com a sessão.
      clearPendingNotificationRoute();
      await signOut(auth);
      useAuthStore.getState().clear();
      // Espelho das sessões (modal de solicitação) não pode sobreviver à conta.
      useUserSessionsStore.getState().clear();
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

      // 0. Best-effort: pedir à API para apagar as fotos do Storage (avatar +
      //    galeria do Explorar). Precisa acontecer ANTES do deleteDoc/delete()
      //    porque depois não há mais idToken. Falha aqui NUNCA bloqueia a
      //    exclusão — a conta some; um arquivo órfão é problema menor.
      await deleteRemotePhotosBestEffort();

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

