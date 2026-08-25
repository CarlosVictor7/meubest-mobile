/**
 * explorePaging — regras PURAS da paginação por offset do Explorar.
 *
 * A parte que fala com a API vive em `../services/exploreQuery.ts`. Aqui
 * ficam só as decisões testáveis sem mock nenhum:
 *
 *   - como concatenar páginas sem duplicar perfis
 *   - quando disparar o prefetch da próxima página
 *   - quando continuar paginando para preencher uma lista curta
 */

/** Tamanho da página. 12 cobre bem a navegação sem varrer a base. */
export const EXPLORE_PAGE_SIZE = 12;

/** Prefetch quando faltarem tantos cards para o fim do que já carregou. */
export const EXPLORE_PREFETCH_AHEAD = 3;

/**
 * Teto de páginas extras buscadas automaticamente numa interação de filtro.
 * Os filtros são server-side, então uma página curta normalmente já vem com
 * `nextOffset: null` — o teto é a rede de segurança caso a API devolva uma
 * página curta com `nextOffset` preenchido.
 */
export const EXPLORE_MAX_AUTOFILL_PAGES = 5;

/**
 * Concatena uma página nova ao que já foi carregado, deduplicando por uid.
 *
 * O dedupe importa porque um perfil pode mudar de posição entre duas páginas
 * por offset (alguém ficou disponível e subiu) — duplicar uid quebraria o
 * `keyExtractor` da FlatList. A ordem existente é preservada; itens novos
 * entram no fim, na ordem em que a página os trouxe.
 */
export function mergeExplorePages<T extends { uid: string }>(
  existing: T[],
  incoming: T[]
): T[] {
  const seen = new Set(existing.map((item) => item.uid));
  const fresh = incoming.filter((item) => {
    if (!item.uid || seen.has(item.uid)) return false;
    seen.add(item.uid);
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
 * Deve buscar a próxima página? Navegar dentro do que já foi carregado não
 * chama a API — só quando a pessoa se aproxima do fim é que a busca dispara.
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
  /** Quantos itens a lista tem agora. */
  filteredCount: number;
  hasMore: boolean;
  isFetching: boolean;
  /** Páginas já buscadas automaticamente nesta interação de filtro. */
  pagesAutoFetched: number;
  pageSize?: number;
  maxAutoPages?: number;
}

/**
 * Continua paginando enquanto a lista tiver menos de uma página e o servidor
 * disser que há mais — no máximo {@link EXPLORE_MAX_AUTOFILL_PAGES} páginas
 * por interação, para nunca varrer a base atrás de um filtro raro.
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
