/**
 * exploreQuery — leitura PAGINADA por offset dos acolhedores do Explorar.
 *
 * Desde 24/08 o Explorar NÃO lê mais o Firestore: chama `GET /explore/listeners`
 * na meubest-api, que decide visibilidade (aprovação, modo Acolher, bloqueio
 * nos dois sentidos, consentimento de foto), aplica os filtros e devolve só o
 * DTO público (`PublicExploreProfile`) com URLs de foto assinadas por 1 h.
 *
 * Zero polling: a tela chama isto no primeiro load, no refresh manual, ao
 * mudar filtro e ao paginar — nada mais.
 */
import { api } from '@shared/services/api';
import { getFirebaseIdToken } from '@shared/services/paymentService';
import { EXPLORE_PAGE_SIZE } from '../utils/explorePaging';
import { toExploreListenersParams, type ExploreFilters } from '../utils/exploreFilters';
import type { PublicExploreProfile } from '../types';

export interface ExplorePage {
  items: PublicExploreProfile[];
  /** Offset da próxima página; null quando o servidor diz que acabou. */
  nextOffset: number | null;
  hasMore: boolean;
  total: number;
}

export interface FetchListenersPageParams {
  filters?: ExploreFilters;
  offset?: number;
  pageSize?: number;
}

export async function fetchListenersPage({
  filters = {},
  offset = 0,
  pageSize = EXPLORE_PAGE_SIZE,
}: FetchListenersPageParams = {}): Promise<ExplorePage> {
  const token = await getFirebaseIdToken();
  const res = await api.getExploreListeners(token, {
    ...toExploreListenersParams(filters),
    limit: pageSize,
    offset,
  });

  const items = Array.isArray(res.items) ? res.items : [];
  const nextOffset = typeof res.nextOffset === 'number' ? res.nextOffset : null;

  return {
    items,
    nextOffset,
    hasMore: nextOffset !== null,
    total: typeof res.total === 'number' ? res.total : items.length,
  };
}
