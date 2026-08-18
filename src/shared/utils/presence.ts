/**
 * presence — regras puras de presença "agora".
 *
 * Dois conceitos distintos que a UI costumava confundir:
 *
 *   isOnline    → a INTENÇÃO declarada pelo usuário (ele virou a chave)
 *   lastSeenAt  → a última vez que o app CONFIRMOU que ele está lá
 *
 * Os dois juntos respondem "esta pessoa pode receber uma chamada agora?".
 * Só `isOnline` não basta: se o sistema mata o app, ninguém desliga a chave e
 * a pessoa fica eternamente online.
 *
 * Quem decide não é o cliente, é o consumidor: o app e a API descartam presença
 * obsoleta na leitura. Isso funciona mesmo quando o cliente não teve chance de
 * se marcar offline — que é exatamente o caso problemático.
 *
 * Funções puras, sem React nem Firebase.
 */

/**
 * Janela de tolerância. Acima disso a presença é considerada obsoleta.
 *
 * 15 min é folgado de propósito: o heartbeat roda a cada 5 min, então há espaço
 * para duas falhas seguidas (rede instável, app suspenso brevemente) antes de
 * alguém sumir da lista. Errar para o lado de manter um acolhedor visível é
 * menos danoso do que esvaziar a lista de quem pode acolher.
 */
export const PRESENCE_STALE_AFTER_MS = 15 * 60 * 1000;

/** Intervalo do heartbeat enquanto o app está em foreground e a chave ligada. */
export const PRESENCE_HEARTBEAT_MS = 5 * 60 * 1000;

export interface PresenceSource {
  isOnline?: boolean;
  /** ISO 8601. Ausente em usuários anteriores a esta funcionalidade. */
  lastSeenAt?: string | null;
}

/**
 * A marca de presença ainda vale?
 *
 * Ausência de `lastSeenAt` conta como **fresca** de propósito: usuários que
 * existiam antes deste campo não podem ser tratados como offline por um dado
 * que nunca tiveram a chance de gravar. Eles passam a ter a marca no primeiro
 * foreground depois da atualização.
 */
export function isPresenceFresh(
  lastSeenAt: string | null | undefined,
  now: number = Date.now(),
  staleAfterMs: number = PRESENCE_STALE_AFTER_MS
): boolean {
  if (!lastSeenAt) return true;

  const seen = Date.parse(lastSeenAt);
  if (Number.isNaN(seen)) return true; // valor corrompido: não penaliza o usuário

  const age = now - seen;
  if (age < 0) return true; // relógio adiantado no cliente — trata como agora

  return age <= staleAfterMs;
}

/**
 * A pessoa está realmente disponível agora?
 * Exige intenção declarada E presença recente.
 */
export function isAvailableNow(
  profile: PresenceSource | null | undefined,
  now: number = Date.now()
): boolean {
  if (!profile?.isOnline) return false;
  return isPresenceFresh(profile.lastSeenAt, now);
}
