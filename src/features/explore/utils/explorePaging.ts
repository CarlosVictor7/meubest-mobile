/**
 * explorePaging — regras PURAS da paginação por cursor do Explorar.
 *
 * A parte que toca o Firestore vive em `../services/exploreQuery.ts`. Aqui
 * ficam só as decisões testáveis sem mock nenhum:
 *
 *   - quais WHERE a query precisa ter (em função da flag de enforcement)
 *   - como concatenar páginas sem duplicar documentos
 *   - quando disparar o prefetch da próxima página
 *   - quando continuar paginando para preencher uma lista filtrada
 */
import { LISTENER_APPROVAL_ENFORCED } from '@shared/utils/listener';

/** Tamanho da página. 12 cobre bem a navegação sem varrer a coleção. */
export const EXPLORE_PAGE_SIZE = 12;

/** Prefetch quando faltarem tantos cards para o fim do que já carregou. */
export const EXPLORE_PREFETCH_AHEAD = 3;

/**
 * Teto de páginas extras buscadas automaticamente numa interação de filtro.
 * Sem esse teto, um filtro raro (ex.: UF sem acolhedores) faria a tela
 * paginar a coleção inteira atrás de resultados que não existem.
 */
export const EXPLORE_MAX_AUTOFILL_PAGES = 5;

/** Um WHERE de igualdade, como dado puro — vira `where(...)` no serviço. */
export type ExploreWhereSpec = readonly [field: string, op: '==', value: string];

/**
 * Os WHERE da query do Explorar.
 *
 * Com `LISTENER_APPROVAL_ENFORCED === false` (hoje): só `role == 'listener'`,
 * que é o que as Rules publicadas permitem listar.
 *
 * Quando a flag ligar: a query passa a exigir também
 * `listenerStatus == 'approved'` — a regra de leitura publicada para o
 * enforcement exige as duas igualdades para a query ser provável.
 *
 * ⚠️ SEM `orderBy`: com duas igualdades, `orderBy('name')` exigiria um índice
 * composto (role + listenerStatus + name) que não pode ser criado neste
 * projeto. Sem orderBy o Firestore atende igualdades múltiplas com merge de
 * índices single-field e ordena implicitamente por `__name__` (id do doc) —
 * ordem estável o suficiente para `startAfter(ultimoSnapshot)` funcionar como
 * cursor. A ordem de EXIBIÇÃO é decidida client-side em `buildExploreList`.
 *
 * @param enforced default = a flag real; parametrizado para os testes
 *                 exercitarem os dois ramos sem mock de módulo.
 */
export function buildExploreQueryConstraintSpecs(
  enforced: boolean = LISTENER_APPROVAL_ENFORCED
): ExploreWhereSpec[] {
  const specs: ExploreWhereSpec[] = [['role', '==', 'listener']];
  if (enforced) {
    specs.push(['listenerStatus', '==', 'approved']);
  }
  return specs;
}

/**
 * Concatena uma página nova ao que já foi carregado, deduplicando por id.
 *
 * O dedupe importa porque um refresh parcial ou um cursor reaproveitado pode
 * devolver um documento que já está na lista — duplicar id quebraria o
 * `keyExtractor` da FlatList. A ordem existente é preservada; itens novos
 * entram no fim, na ordem em que a página os trouxe.
 */
export function mergeExplorePages<T extends { id: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const seen = new Set(existing.map((item) => item.id));
  const fresh = incoming.filter((item) => {
    if (!item.id || seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
  return fresh.length === 0 ? existing : [...existing, ...fresh];
}

export interface PrefetchInput {
  /** Índice do card visível na lista exibida. */
  currentIndex: number;
  /** Quantos itens a lista exibida tem. */
  loadedCount: number;
  hasMore: boolean;
  isFetching: boolean;
  /** Antecedência do prefetch. Default: {@link EXPLORE_PREFETCH_AHEAD}. */
  prefetchAhead?: number;
}

/**
 * Deve buscar a próxima página? Navegar dentro do que já foi carregado custa
 * ZERO reads — só quando a pessoa se aproxima do fim é que a busca dispara.
 */
export function shouldPrefetchNextPage({
  currentIndex,
  loadedCount,
  hasMore,
  isFetching,
  prefetchAhead = EXPLORE_PREFETCH_AHEAD,
}: PrefetchInput): boolean {
  if (!hasMore || isFetching) return false;
  if (loadedCount <= 0) return false;
  return currentIndex >= loadedCount - prefetchAhead;
}

export interface AutoFillInput {
  /** Quantos itens a lista FILTRADA tem agora. */
  filteredCount: number;
  hasMore: boolean;
  isFetching: boolean;
  /** Páginas já buscadas automaticamente nesta interação de filtro. */
  pagesAutoFetched: number;
  pageSize?: number;
  maxAutoPages?: number;
}

/**
 * Com filtros ativos, a lista filtrada pode ficar curta mesmo havendo mais
 * documentos no servidor. Continua paginando enquanto ela tiver menos de uma
 * página — mas no máximo {@link EXPLORE_MAX_AUTOFILL_PAGES} páginas por
 * interação, para nunca varrer a coleção inteira atrás de um filtro raro.
 */
export function shouldAutoFillFilteredPage({
  filteredCount,
  hasMore,
  isFetching,
  pagesAutoFetched,
  pageSize = EXPLORE_PAGE_SIZE,
  maxAutoPages = EXPLORE_MAX_AUTOFILL_PAGES,
}: AutoFillInput): boolean {
  if (!hasMore || isFetching) return false;
  if (pagesAutoFetched >= maxAutoPages) return false;
  return filteredCount < pageSize;
}
