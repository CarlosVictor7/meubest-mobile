/**
 * notificationRouting — decisão PURA de "para onde uma notificação leva".
 *
 * Separada de propósito da navegação em si (efeito): a decisão é testável em
 * milissegundos sem emulador, e o cold start — o cenário mais difícil de
 * reproduzir manualmente — fica coberto por teste puro.
 *
 * Destinos:
 *
 *   incoming_support_request  → Home. NUNCA a VideoRoom direto: entre o envio
 *                               da push e o toque a chamada pode ter expirado,
 *                               sido aceita por outra pessoa ou cancelada. O
 *                               `useIncomingCall` da Home revalida com getDoc
 *                               e só então mostra o modal — reutilizamos essa
 *                               defesa em vez de duplicá-la.
 *
 *   scheduled_session_created  → SessionDetail da sessão (o modal de
 *                               solicitação também aparece pelo snapshot).
 *   scheduled_session_reminder → SessionDetail da sessão.
 *   session_accepted / rejected / cancelled / expired / started
 *                              → SessionDetail da sessão. NUNCA a VideoRoom:
 *                               o ENTRAR do detalhe passa pelo `/join`, que
 *                               é quem valida a janela.
 *                               (Se a sessão não existir mais, a própria tela
 *                               trata — fallback seguro para a lista.)
 *
 *   listener_status            → Home. O estado do ciclo de acolhedor mora no
 *                               perfil (onSnapshot) — a pessoa abre o app e a
 *                               Home já reflete o status atual. Nenhuma tela
 *                               nova, nenhum dado do payload é necessário.
 *
 * Payload desconhecido ou malformado → null, nunca lança.
 */

export type NotificationRoute =
  | { kind: 'home' }
  | { kind: 'sessionDetail'; sessionId: string };

/** Tipos de push que apontam para o detalhe de UMA sessão. */
export const SESSION_DETAIL_NOTIFICATION_TYPES = [
  'scheduled_session_created',
  'scheduled_session_reminder',
  'session_accepted',
  'session_rejected',
  'session_cancelled',
  'session_expired',
  'session_started',
] as const;

export function buildNotificationRoute(data: unknown): NotificationRoute | null {
  if (!data || typeof data !== 'object') return null;

  const payload = data as Record<string, unknown>;
  const type = payload.type;
  const sessionId = payload.sessionId;
  const hasSessionId = typeof sessionId === 'string' && sessionId.length > 0;

  switch (type) {
    case 'incoming_support_request':
      // A Home revalida a sessão — não precisamos do id para navegar.
      return { kind: 'home' };

    case 'listener_status':
      // O status verdadeiro vem do perfil, não do payload — Home basta.
      return { kind: 'home' };

    case 'scheduled_session_created':
    case 'scheduled_session_reminder':
    case 'session_accepted':
    case 'session_rejected':
    case 'session_cancelled':
    case 'session_expired':
    case 'session_started':
      return hasSessionId
        ? { kind: 'sessionDetail', sessionId: sessionId as string }
        : null;

    default:
      return null;
  }
}
