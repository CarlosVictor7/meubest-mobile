import { appConfig } from '@constants/appConfig';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  token?: string;
}

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
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
};
