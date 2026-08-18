/**
 * pagination — exibição em páginas de 5 no histórico de sessões.
 *
 * ┌── O que isto corrige, e por que não era só cosmético ───────────────────────┐
 * │ O histórico não tinha paginação: renderizava de uma vez o que o hook        │
 * │ trouxesse. E o hook trazia pouco.                                          │
 * │                                                                            │
 * │ Medido em produção (leitura, conta real): o usuário tinha 114 sessões, das │
 * │ quais 54 concluídas — mas a tela mostrava 13.                              │
 * │                                                                            │
 * │ A causa é a combinação de dois fatos:                                      │
 * │   • a consulta trazia as 30 mais RECENTES, ordenadas por createdAt;        │
 * │   • 58 das 114 sessões estão `cancelled`, e o histórico filtra `completed`.│
 * │                                                                            │
 * │ Ou seja: o limite era gasto majoritariamente com sessões que a tela jamais │
 * │ mostraria, e 41 sessões concluídas ficavam invisíveis para sempre —        │
 * │ sem botão, sem aviso, sem jeito de alcançar.                               │
 * │                                                                            │
 * │ Por isso a correção tem duas metades: buscar o suficiente (useUserSessions)│
 * │ e revelar aos poucos (aqui).                                               │
 * └────────────────────────────────────────────────────────────────────────────┘
 *
 * Funções puras, sem React. A tela guarda só um número — quantos itens estão
 * visíveis — e estas funções derivam o resto. Estado mínimo significa que
 * "carregar mais" nunca pode perder o que já estava na tela: a lista visível é
 * sempre um prefixo da lista completa.
 */

/** Tamanho da página do histórico: 5 → 10 → 15 → ... */
export const HISTORY_PAGE_SIZE = 5;

/** Quantas próximas sessões aparecem antes de precisar expandir. */
export const UPCOMING_PAGE_SIZE = 3;

/**
 * O prefixo visível da lista.
 *
 * `visibleCount` menor que zero é tratado como zero, e maior que o total é
 * tratado como o total — a tela nunca precisa validar o próprio contador.
 */
export function paginate<T>(items: T[] | null | undefined, visibleCount: number): T[] {
  if (!items || items.length === 0) return [];
  if (!Number.isFinite(visibleCount) || visibleCount <= 0) return [];
  return items.slice(0, Math.min(visibleCount, items.length));
}

/** Ainda há itens escondidos? É isto que decide se o botão VER MAIS existe. */
export function hasMore(
  items: readonly unknown[] | null | undefined,
  visibleCount: number
): boolean {
  const total = items?.length ?? 0;
  return total > Math.max(0, visibleCount);
}

/** Quantos itens ainda faltam aparecer. Vai no rótulo do botão. */
export function remaining(
  items: readonly unknown[] | null | undefined,
  visibleCount: number
): number {
  const total = items?.length ?? 0;
  return Math.max(0, total - Math.max(0, visibleCount));
}

/**
 * O próximo contador ao tocar em VER MAIS.
 *
 * Nunca passa do total: sem isso o contador cresceria indefinidamente e
 * `hasMore` continuaria correto por acidente, mas `remaining` mentiria.
 */
export function advance(
  visibleCount: number,
  total: number,
  pageSize: number = HISTORY_PAGE_SIZE
): number {
  const safeTotal = Math.max(0, total);
  const safeCurrent = Math.max(0, visibleCount);
  return Math.min(safeCurrent + pageSize, safeTotal);
}
