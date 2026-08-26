/**
 * scheduling — transições de sessão AGENDADA, sempre pela meubest-api.
 *
 * O cliente nunca escreve `status`/`listenerId`/`acceptedAt` em sessão
 * agendada. Aqui só obtemos o ID token, chamamos o endpoint e traduzimos o
 * erro HTTP em uma mensagem que a tela pode mostrar.
 *
 * Imediatas (`type: 'immediate'`) NÃO passam por aqui — continuam na
 * transação do `useIncomingCall`.
 */
import { api, isApiError } from '@shared/services/api';
import { getFirebaseIdToken } from '@shared/services/paymentService';

export type SchedulingAction = 'accept' | 'reject' | 'cancel' | 'join';

export class SchedulingError extends Error {
  constructor(
    public action: SchedulingAction,
    public statusCode: number | null,
    message: string
  ) {
    super(message);
    this.name = 'SchedulingError';
  }
}

const GENERIC = 'Não foi possível concluir agora. Tente novamente em instantes.';

/** Mensagem amigável por ação × código HTTP. Função pura. */
export function describeSchedulingError(action: SchedulingAction, statusCode: number | null): string {
  if (statusCode === 401) return 'Sua sessão expirou. Entre novamente no app.';
  if (statusCode === 403) return 'Você não pode realizar esta ação nesta sessão.';
  if (statusCode === 404) return 'Esta sessão não existe mais.';
  if (statusCode === 409) {
    switch (action) {
      case 'accept':
        return 'Esta solicitação não está mais disponível — pode ter sido cancelada ou já respondida.';
      case 'reject':
        return 'Esta solicitação já foi respondida ou cancelada.';
      case 'cancel':
        return 'Esta sessão já não pode ser cancelada.';
      case 'join':
        return 'A sala ainda não está aberta — ela abre 15 minutos antes do horário e fecha 30 minutos depois.';
    }
  }
  return GENERIC;
}

async function run(action: SchedulingAction, sessionId: string) {
  try {
    const token = await getFirebaseIdToken();
    switch (action) {
      case 'accept':
        return await api.acceptScheduledSession(token, sessionId);
      case 'reject':
        return await api.rejectScheduledSession(token, sessionId);
      case 'cancel':
        return await api.cancelScheduledSession(token, sessionId);
      case 'join':
        return await api.joinScheduledSession(token, sessionId);
    }
  } catch (err) {
    const code = isApiError(err) ? err.statusCode : null;
    throw new SchedulingError(action, code, describeSchedulingError(action, code));
  }
}

export const acceptScheduledSession = (sessionId: string) => run('accept', sessionId);
export const rejectScheduledSession = (sessionId: string) => run('reject', sessionId);
export const cancelScheduledSession = (sessionId: string) => run('cancel', sessionId);
export const joinScheduledSession = (sessionId: string) => run('join', sessionId);

/**
 * Prepara a entrada na sala: sessão agendada passa pelo `/join` (409 fora da
 * janela); imediata entra direto. Resolve `true` quando pode abrir o VideoRoom.
 */
export async function prepareJoin(session: { id: string; type?: string }): Promise<void> {
  if (session.type !== 'scheduled') return;
  await joinScheduledSession(session.id);
}
