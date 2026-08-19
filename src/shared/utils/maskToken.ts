/**
 * maskToken — máscara de credencial para log.
 *
 * Um ExpoPushToken completo é credencial de envio: quem o tiver consegue
 * mandar push arbitrária para o aparelho. A auditoria de 19/08 encontrou o
 * token inteiro em 6 pontos de log (2 no mobile, 4 na API).
 *
 * A máscara preserva o prefixo (dá para saber que É um token e correlacionar
 * chamadas) e os 4 últimos caracteres (dá para distinguir dois tokens), sem
 * jamais revelar o miolo.
 *
 * Espelhada em `meubest-api/src/utils/maskToken.ts`.
 */
export function maskToken(token: string | null | undefined): string {
  if (!token) return '(ausente)';
  if (token.length <= 22) return `${token.slice(0, 4)}…`;
  return `${token.slice(0, 18)}…${token.slice(-4)}`;
}
