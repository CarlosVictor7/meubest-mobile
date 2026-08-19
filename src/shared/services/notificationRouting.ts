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
 *   scheduled_session_created  → SessionDetail da sessão.
 *   scheduled_session_reminder → SessionDetail da sessão.
 *                               (Se a sessão não existir mais, a própria tela
 *                               trata — fallback seguro para a lista.)
 *
 * Payload desconhecido ou malformado → null, nunca lança.
 */

export type NotificationRoute =
  | { kind: 'home' }
  | { kind: 'sessionDetail'; sessionId: string };

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

    case 'scheduled_session_created':
    case 'scheduled_session_reminder':
      return hasSessionId
        ? { kind: 'sessionDetail', sessionId: sessionId as string }
        : null;

    default:
      return null;
  }
}
