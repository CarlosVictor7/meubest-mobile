/**
 * exploreFilters — o estado de filtro do Explorar e sua tradução para a API.
 *
 * Desde 24/08 a decisão de QUEM aparece (aprovação, modo Acolher, bloqueio nos
 * dois sentidos, consentimento de foto) e a APLICAÇÃO dos filtros vivem no
 * servidor (`GET /explore/listeners`). Aqui só resta a parte pura e testável:
 * o estado de filtro da UI e sua serialização em params.
 */
import type { ExploreAgeRange, ExploreListenersParams } from '../types';

export interface ExploreFilters {
  /** Busca por nome público ou bio (server-side). */
  search?: string;
  /** UF. Filtramos por estado, não por cidade — `city` é composta ("São Paulo - SP"). */
  state?: string;
  /** id do tema em `SESSION_THEMES`. */
  themeId?: string;
  /** key em `EXPLORE_RELIGIONS`. */
  religion?: string;
  ageRange?: ExploreAgeRange | '';
  /** Mostrar apenas quem pode receber FALAR AGORA. */
  onlyOnline?: boolean;
}

/** Estado de filtro → params da API. Vazios viram `undefined` (omitidos da URL). */
export function toExploreListenersParams(filters: ExploreFilters): ExploreListenersParams {
  const search = filters.search?.trim();
  return {
    search: search || undefined,
    state: filters.state || undefined,
    theme: filters.themeId || undefined,
    religion: filters.religion || undefined,
    ageRange: filters.ageRange || undefined,
    onlyReachable: filters.onlyOnline ? true : undefined,
  };
}
