/**
 * notificationNavigation — executa a intenção decidida por
 * `buildNotificationRoute`, respeitando o ciclo de vida do app.
 *
 * O problema que este módulo resolve: no COLD START a notificação é tocada
 * antes de o NavigationContainer existir e antes de Auth/Profile terminarem o
 * bootstrap. Navegar cedo demais é race condition; ignorar o toque é a lacuna
 * L1/L2 da auditoria (o app abria na Home e nada acontecia).
 *
 * Estratégia: fila de UMA intenção pendente.
 *
 *   requestNotificationNavigation(route)  → guarda e tenta
 *   setNotificationNavigationReady(bool)  → o RootNavigator informa quando a
 *                                           árvore autenticada está montada
 *   flush                                 → só navega quando AMBOS valem
 *
 * Uma intenção nova substitui a anterior — o toque mais recente é o que a
 * pessoa quer ver. Usuário deslogado nunca recebe a navegação: o RootNavigator
 * só marca "pronto" com sessão válida e perfil completo.
 */
import { createNavigationContainerRef } from '@react-navigation/native';
import type { RootStackParamList } from './types';
import type { NotificationRoute } from '@shared/services/notificationRouting';

export const navigationRef = createNavigationContainerRef<RootStackParamList>();

let pendingRoute: NotificationRoute | null = null;
let appReady = false;

function flush(): void {
  if (!pendingRoute || !appReady || !navigationRef.isReady()) return;

  const route = pendingRoute;
  pendingRoute = null;

  try {
    if (route.kind === 'home') {
      navigationRef.navigate('App', {
        screen: 'HomeTab',
        params: { screen: 'Home' },
      });
    } else {
      navigationRef.navigate('App', {
        screen: 'SessionsTab',
        params: {
          screen: 'SessionDetail',
          params: { sessionId: route.sessionId },
        },
      });
    }
  } catch (err) {
    // Navegação nunca pode derrubar o app por causa de uma push malformada.
    console.warn('[NotificationNavigation] Falha ao navegar:', err);
  }
}

/** Chamado pelos listeners de notificação (toque em foreground/background/cold start). */
export function requestNotificationNavigation(route: NotificationRoute | null): void {
  if (!route) return;
  pendingRoute = route;
  flush();
}

/**
 * Chamado pelo RootNavigator: `true` somente quando a árvore autenticada
 * (App + perfil completo) está montada.
 *
 * `false` NÃO limpa a fila: no cold start o app passa pelo Bootstrap (não
 * pronto) ANTES de montar a árvore, e a intenção da push que abriu o app
 * precisa sobreviver a essa janela. Quem limpa a fila é o logout, via
 * `clearPendingNotificationRoute` — push antiga não pode navegar a sessão
 * de outra conta.
 */
export function setNotificationNavigationReady(ready: boolean): void {
  appReady = ready;
  if (ready) flush();
}

/** Chamado no logout explícito: intenção pendente morre com a sessão. */
export function clearPendingNotificationRoute(): void {
  pendingRoute = null;
}
