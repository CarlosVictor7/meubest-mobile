import { useAuthStore } from '@shared/stores/authStore';
import { signOut } from 'firebase/auth';
import { auth, db } from '@shared/services/firebase';
import { doc, updateDoc, deleteField } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { runLogoutCleanup } from '../utils/logoutCleanup';
import { runDeleteAccountFlow, ACCOUNT_SCOPED_STORAGE_KEYS } from '../utils/deleteAccountFlow';
import { api } from '@shared/services/api';
import { clearPendingNotificationRoute } from '../../../navigation/notificationNavigation';
import { useUserSessionsStore } from '@features/session/stores/userSessionsStore';

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

  /**
   * Exclusão de conta — SERVER-AUTHORITATIVE (26/08): `DELETE /me`. A API
   * marca `accountStatus:'deleted'`, anonimiza, apaga o Storage (fotos
   * inclusive) e deleta o Firebase Auth. O app não faz deleteDoc nem
   * `currentUser.delete()` — por isso o gate de "login recente" do SDK não se
   * aplica; 401 da API vira `auth/requires-recent-login` para a UI já existente.
   * Orquestração pura e testada em `../utils/deleteAccountFlow`.
   */
  const deleteAccount = async () => {
    try {
      if (!user) throw new Error('Usuário não autenticado');

      await runDeleteAccountFlow({
        getIdToken: () => auth.currentUser?.getIdToken() ?? Promise.resolve(null),
        deleteMyAccount: (token) => api.deleteMyAccount(token),
        cleanupLocal: async () => {
          clearPendingNotificationRoute();
          useAuthStore.getState().clear();
          useUserSessionsStore.getState().clear();
          await AsyncStorage.multiRemove([...ACCOUNT_SCOPED_STORAGE_KEYS]);
        },
        hasSession: () => Boolean(auth.currentUser),
        signOut: () => signOut(auth),
      });
    } catch (error) {
      console.error('[useAuth] deleteAccount error:', error);
      throw error;
    }
  };

  return { user, profile, loading, isAdmin, isAuthenticated, logout, deleteAccount };
}

