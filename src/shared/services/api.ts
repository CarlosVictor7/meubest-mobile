import { appConfig } from '@constants/appConfig';
import type {
  ExploreListenersParams,
  ExploreListenersResponse,
  ExploreMeResponse,
} from '@features/explore/types';
import { buildExploreQueryString } from '@features/explore/utils/exploreQueryString';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  token?: string;
}

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/** Resposta das transições de sessão agendada (`/sessions/:id/accept|reject|cancel|join`). */
export interface SessionTransitionResponse {
  ok: true;
  sessionId: string;
  status: string;
  /** false quando a transição já tinha acontecido (repetir = no-op 200). */
  changed: boolean;
  event?: string;
}

/** Resposta de `DELETE /me`. */
export interface DeleteMyAccountResponse {
  ok: true;
  deleted: true;
  /** true quando a conta já tinha sido excluída antes (repetição = no-op 200). */
  alreadyDeleted?: boolean;
}

async function request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${appConfig.apiUrl}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, data?.error ?? 'Erro desconhecido');
  }

  return data as T;
}

// ─── Endpoints ────────────────────────────────────────────────────

export const api = {
  /** Cria uma sessão de pagamento Stripe (retorna paymentIntentClientSecret para Payment Sheet) */
  createCheckoutSession: (body: {
    amount: number;
    userId: string;
    userEmail: string;
    type?: 'deposit' | 'tip' | 'session';
    metadata?: Record<string, string>;
  }) => request<{ clientSecret?: string; id?: string; url?: string }>(
    '/api/create-checkout-session',
    { method: 'POST', body }
  ),

  /** Envia e-mail via Resend */
  sendEmail: (body: { to: string; subject: string; html: string }) =>
    request('/api/send-email', { method: 'POST', body }),

  /** Analisa transcrição de sessão com Gemini */
  analyzeSession: (sessionId: string) =>
    request<{ summary: string; evaluation: 'Positiva' | 'Negativa' | 'N/A' }>(
      '/api/analyze-session',
      { method: 'POST', body: { sessionId } }
    ),

  /**
   * Posição na fila de treinamento de acolhedor.
   * A posição vem SEMPRE da API (ordenada por `listenerTrainingRequestedAt`
   * do servidor) e NUNCA é armazenada no Firestore — seria um dado derivado
   * que apodrece a cada mudança na fila.
   */
  getListenerQueuePosition: (token: string) =>
    request<{ ok: boolean; status: string; position: number | null; total: number }>(
      '/listener/queue-position',
      { token }
    ),

  // ─── Explorar (perfis públicos; visibilidade decidida no servidor) ───────
  /** Lista paginada por offset. Filtros vazios são omitidos da query. */
  getExploreListeners: (token: string, params: ExploreListenersParams = {}) =>
    request<ExploreListenersResponse>(
      `/explore/listeners${buildExploreQueryString(params)}`,
      { token }
    ),
  /** O próprio perfil como terceiros o veem + estado de visibilidade. */
  getExploreMe: (token: string) => request<ExploreMeResponse>('/explore/me', { token }),

  // ─── Conta ───────────────────────────────────────────────────────────────
  /**
   * `DELETE /me` — exclusão da conta é SERVER-AUTHORITATIVE: a API marca
   * `accountStatus:'deleted'`, anonimiza o doc, apaga o Storage e deleta o
   * Firebase Auth. O app NÃO faz deleteDoc nem `currentUser.delete()`.
   * Idempotente: repetir devolve 200 com `alreadyDeleted:true`. 401 sem token.
   */
  deleteMyAccount: (token: string) =>
    request<DeleteMyAccountResponse>('/me', { method: 'DELETE', token }),

  // ─── Sessão agendada: transições SÓ via API (server-authoritative) ───────
  // Erros: 401 sem token · 403 ator errado · 404 · 409 transição inválida ou
  // fora da janela. Repetir a mesma ação = 200 com `changed: false`.
  /** Acolhedor aceita a solicitação (`pending → accepted`). */
  acceptScheduledSession: (token: string, sessionId: string) =>
    request<SessionTransitionResponse>(`/sessions/${encodeURIComponent(sessionId)}/accept`, {
      method: 'POST',
      token,
    }),
  /** Acolhedor recusa a solicitação (`pending → rejected`). */
  rejectScheduledSession: (token: string, sessionId: string) =>
    request<SessionTransitionResponse>(`/sessions/${encodeURIComponent(sessionId)}/reject`, {
      method: 'POST',
      token,
    }),
  /** Qualquer participante cancela (`pending|accepted → cancelled`). */
  cancelScheduledSession: (token: string, sessionId: string) =>
    request<SessionTransitionResponse>(`/sessions/${encodeURIComponent(sessionId)}/cancel`, {
      method: 'POST',
      token,
    }),
  /** Entrar na sala dentro da janela (−15/+30 min); grava `joinedAt.{uid}`/`startedAt`. */
  joinScheduledSession: (token: string, sessionId: string) =>
    request<SessionTransitionResponse>(`/sessions/${encodeURIComponent(sessionId)}/join`, {
      method: 'POST',
      token,
    }),
};
