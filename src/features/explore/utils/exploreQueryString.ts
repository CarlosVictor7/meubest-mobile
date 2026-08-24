/**
 * exploreQueryString — monta a query de `GET /explore/listeners`.
 *
 * Manual (encodeURIComponent) em vez de `URLSearchParams`: o polyfill do RN
 * historicamente não implementa `toString()`. Função pura, testada.
 *
 * Regras: string vazia/undefined é omitida; `onlyReachable` só vai quando
 * true; `limit`/`offset` só quando forem números finitos.
 */
import type { ExploreListenersParams } from '../types';

export function buildExploreQueryString(params: ExploreListenersParams): string {
  const pairs: string[] = [];
  const add = (key: string, value: string | number | undefined) => {
    if (value === undefined || value === '') return;
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  };

  add('search', params.search?.trim());
  add('state', params.state);
  add('theme', params.theme);
  add('religion', params.religion);
  add('ageRange', params.ageRange);
  if (params.onlyReachable) add('onlyReachable', 'true');
  if (typeof params.limit === 'number' && Number.isFinite(params.limit)) add('limit', params.limit);
  if (typeof params.offset === 'number' && Number.isFinite(params.offset)) {
    add('offset', params.offset);
  }

  return pairs.length > 0 ? `?${pairs.join('&')}` : '';
}
