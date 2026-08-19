/**
 * logoutCleanup — a política do logout explícito, em forma pura e testável.
 *
 * O bug que isto corrige (auditoria 19/08, §5): a limpeza no Firestore tinha
 * um `.catch()` que só logava, e o `signOut` acontecia mesmo assim. Com a rede
 * falhando naquele instante, a conta ficava com `isOnline: true` e `pushToken`
 * vivo — recebendo push de uma conta da qual a pessoa SAIU, e sem sessão para
 * corrigir. É a provável origem dos 9 fantasmas medidos em produção.
 *
 * Regra do GO (§9): SAIR DA CONTA não pode concluir silenciosamente deixando
 * push ativa. Se a limpeza crítica falhar após as tentativas, o logout FALHA
 * com erro visível e o estado permanece coerente (ainda logado, ainda
 * recebendo — a pessoa vê o erro e tenta de novo com rede).
 *
 * APP FECHADO ≠ LOGOUT: nada aqui roda quando o app é simplesmente fechado.
 */

/** Tentativas totais da limpeza. Limitado — nunca retry infinito. */
export const LOGOUT_CLEANUP_ATTEMPTS = 2;

/** Pausa entre tentativas (ms). Curta: logout é interação direta do usuário. */
export const LOGOUT_CLEANUP_RETRY_DELAY_MS = 700;

/** Mensagem que a UI mostra quando a limpeza não pôde ser garantida. */
export const LOGOUT_CLEANUP_FAILED_MESSAGE =
  'Não conseguimos encerrar sua disponibilidade no servidor. ' +
  'Verifique sua conexão e tente sair novamente.';

export class LogoutCleanupError extends Error {
  constructor(cause?: unknown) {
    super(LOGOUT_CLEANUP_FAILED_MESSAGE);
    this.name = 'LogoutCleanupError';
    (this as any).cause = cause;
  }
}

/**
 * Executa `operation` com retry limitado. Resolve no primeiro sucesso; após
 * esgotar as tentativas, lança `LogoutCleanupError` embrulhando a última falha.
 *
 * `delayFn` é injetável para os testes não dependerem de relógio real.
 */
export async function runLogoutCleanup(
  operation: () => Promise<void>,
  attempts: number = LOGOUT_CLEANUP_ATTEMPTS,
  delayFn: (ms: number) => Promise<void> = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms))
): Promise<void> {
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= Math.max(1, attempts); attempt++) {
    try {
      await operation();
      return;
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await delayFn(LOGOUT_CLEANUP_RETRY_DELAY_MS);
      }
    }
  }

  throw new LogoutCleanupError(lastError);
}
