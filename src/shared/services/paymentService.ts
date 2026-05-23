import { auth } from './firebase';
import { appConfig } from '@constants/appConfig';

// ─── Tipos compartilhados ─────────────────────────────────────────────────────

export interface TipPixResponse {
  tipId: string;
  status: 'pending' | 'paid' | 'failed' | 'canceled' | 'refunded';
  amountGross: number;
  receiverAmount: number;
  totalFeeAmount: number;
  paymentMethod: 'pix';
  provider: 'asaas';
  providerPaymentId?: string;
  providerCheckoutUrl?: string;
  pixQrCode?: string;
  pixQrCodeBase64?: string;
  pixCopyPaste?: string;
}

export interface WalletSummary {
  balanceRewards: number;
  totalTipsReceived: number;
  totalWithdrawn: number;
  pendingWithdrawals: number;
  currency: 'BRL';
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'tip_sent' | 'tip_received' | 'total_fee' | 'gateway_fee' | 'platform_net_fee' | 'withdrawal' | 'refund';
  amount: number;
  currency: 'BRL';
  status: 'pending' | 'paid' | 'failed' | 'canceled';
  tipId?: string;
  withdrawalId?: string;
  createdAt: unknown;
  metadata?: any;
}

export interface CreateTipPixParams {
  toUserId: string;
  amount: number;
  message?: string;
  relatedSessionId?: string;
}

export interface RequestWithdrawalParams {
  amount: number;
  pixKey: string;
  pixKeyType: 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'EVP';
  bankName?: string;
}


// ─── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Obtém o Firebase ID Token do usuário autenticado.
 * Nunca envie esse token para terceiros — apenas para a meubest-api.
 */
export async function getFirebaseIdToken(): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error('Usuário não autenticado. Faça login novamente.');
  }
  // forceRefresh=false usa o token em cache se válido (< 1h)
  return currentUser.getIdToken(false);
}

/**
 * Faz chamadas autenticadas para a meubest-api.
 */
async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getFirebaseIdToken();
  const baseUrl = appConfig.apiUrl.replace(/\/$/, '');

  // Em dev com ngrok, bypassa a tela de aviso do browser (retornaria HTML em vez de JSON)
  const ngrokHeader: Record<string, string> = __DEV__ && baseUrl.includes('ngrok')
    ? { 'ngrok-skip-browser-warning': 'true' }
    : {};

  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...ngrokHeader,
      ...(options.headers as Record<string, string> | undefined),
    },
  });

  const responseText = await response.text();
  let json: any;
  try {
    json = JSON.parse(responseText);
  } catch (err) {
    throw new Error(!response.ok ? `Erro ${response.status}: ${responseText}` : 'Resposta inválida do servidor (não é JSON)');
  }

  if (!response.ok) {
    throw new Error(json?.error ?? `Erro ${response.status} na API`);
  }

  return json?.data as T;
}

// ─── Funções públicas ─────────────────────────────────────────────────────────

/**
 * Cria um pagamento Pix de gorjeta para outro usuário.
 * 
 * IMPORTANTE: O cálculo 70/30 é feito no backend — nunca no frontend.
 * Não envie receiverAmount ou feeAmount — apenas amount bruto.
 * 
 * @param params.toUserId  UID do recebedor (acolhedor)
 * @param params.amount    Valor bruto em reais (ex: 10.00)
 */
export async function createTipPixPayment(
  params: CreateTipPixParams
): Promise<TipPixResponse> {
  return apiRequest<TipPixResponse>('/tips/create-pix-payment', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Retorna o resumo da carteira do usuário autenticado.
 */
export async function getWalletSummary(): Promise<WalletSummary> {
  return apiRequest<WalletSummary>('/wallet/summary');
}

/**
 * Retorna o histórico de transações do usuário autenticado.
 */
export async function getWalletTransactions(): Promise<Transaction[]> {
  return apiRequest<Transaction[]>('/wallet/transactions');
}

/**
 * Solicita um saque do saldo disponível.
 * O saldo é reservado com Firestore transaction no backend — nunca confie no frontend.
 */
export async function requestWithdrawal(
  params: RequestWithdrawalParams
): Promise<{ id: string; status: string; amount: number }> {
  return apiRequest('/wallet/request-withdrawal', {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

/**
 * Retorna gorjetas enviadas e recebidas do usuário autenticado.
 */
export async function getMyTips(): Promise<{
  sent: TipPixResponse[];
  received: TipPixResponse[];
}> {
  return apiRequest('/tips/me');
}

// ─── Consulta de status ──────────────────────────────────────────────────────

export interface TipStatusResponse {
  tipId: string;
  status: 'pending' | 'paid' | 'confirmed' | 'received' | 'failed' | 'canceled' | 'refunded';
}

/**
 * Consulta o status atual de uma gorjeta pelo ID.
 * Usado como fallback de polling quando o onSnapshot do Firestore não está disponível.
 */
export async function getTipStatus(tipId: string): Promise<TipStatusResponse> {
  return apiRequest<TipStatusResponse>(`/tips/${tipId}/status`);
}

// ─── DEV ONLY ─────────────────────────────────────────────────────────────────

export interface SimulateTipPaidResponse {
  processed: boolean;
  alreadyPaid: boolean;
  tipId: string;
  message: string;
}

/**
 * [DEV ONLY] Simula a confirmação de pagamento de uma gorjeta pending.
 * Chama POST /dev/tips/:tipId/simulate-paid na API local.
 * Requer Firebase Auth token.
 *
 * ⚠️  Não usar em produção — o endpoint retorna 403 fora de development.
 */
export async function simulateTipPaid(tipId: string): Promise<SimulateTipPaidResponse> {
  return apiRequest<SimulateTipPaidResponse>(`/dev/tips/${tipId}/simulate-paid`, {
    method: 'POST',
  });
}
