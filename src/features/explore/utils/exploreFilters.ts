/**
 * exploreFilters — quem aparece no Explorar, e em que ordem.
 *
 * Toda a decisão de visibilidade vive aqui, em funções puras. O motivo é
 * direto: esconder alguém do Explorar é uma decisão de **segurança** (bloqueio)
 * e de **compliance** (só acolhedor autorizado), e essas duas coisas precisam
 * ser testáveis sem subir tela nenhuma.
 */
import { canActAsListener } from '@shared/utils/listener';
import type { ListenerStatus } from '@models/user';
import { isAvailableNow } from '@shared/utils/presence';
import { getDisplayName } from '@shared/utils/displayName';

export interface ExploreCandidate {
  id: string;
  role?: string;
  listenerStatus?: ListenerStatus;
  name?: string;
  preferredName?: string;
  bio?: string;
  city?: string;
  state?: string;
  ageRange?: string;
  gender?: string;
  photoURL?: string;
  interests?: string[];
  rating?: number;
  isOnline?: boolean;
  lastSeenAt?: string | null;
  blockedUserIds?: string[];
  [key: string]: any;
}

export interface ExploreViewer {
  uid: string;
  blockedUserIds?: string[];
}

export interface ExploreFilters {
  /** Busca por nome público ou bio. */
  search?: string;
  /** UF. Filtramos por estado, não por cidade — ver nota em `matchesLocation`. */
  state?: string;
  /** id do tema em `SESSION_THEMES`. */
  themeId?: string;
  /** Mostrar apenas quem está disponível agora. */
  onlyOnline?: boolean;
}

function normalize(s: string | null | undefined): string {
  if (typeof s !== 'string') return '';
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
}

/**
 * O bloqueio vale nos DOIS sentidos.
 *
 * O sentido "ele me bloqueou" depende de `blockedUserIds` do candidato, que só
 * chega quando as Rules permitem ler o documento — e elas permitem, porque
 * candidatos do Explorar têm `role == 'listener'`. Ainda assim tratamos a
 * ausência do campo como "não bloqueou", que é o padrão seguro para leitura.
 */
export function isBlockedEitherWay(
  candidate: ExploreCandidate,
  viewer: ExploreViewer
): boolean {
  const iBlockedThem = (viewer.blockedUserIds ?? []).includes(candidate.id);
  const theyBlockedMe = (candidate.blockedUserIds ?? []).includes(viewer.uid);
  return iBlockedThem || theyBlockedMe;
}

/**
 * Filtro por localização: **UF, não cidade**.
 *
 * `city` é gravada como `"São Paulo - SP"` (`ProfileFormScreen:146`), um formato
 * composto que só funciona por igualdade exata de string. Filtrar por cidade
 * exata também seria estreito demais num app de acolhimento — quase sempre
 * devolveria lista vazia. A cidade continua sendo exibida no card.
 */
export function matchesLocation(candidate: ExploreCandidate, state?: string): boolean {
  if (!state) return true;
  return candidate.state === state;
}

export function matchesSearch(candidate: ExploreCandidate, search?: string): boolean {
  const q = normalize(search);
  if (!q) return true;
  const haystack = `${normalize(getDisplayName(candidate, ''))} ${normalize(candidate.bio)}`;
  return haystack.includes(q);
}

export function matchesTheme(candidate: ExploreCandidate, themeId?: string): boolean {
  if (!themeId) return true;
  return Array.isArray(candidate.interests) && candidate.interests.includes(themeId);
}

/**
 * A pessoa pode aparecer no Explorar?
 *
 * Três barreiras, todas obrigatórias:
 *   1. não é o próprio usuário
 *   2. não há bloqueio em nenhum dos dois sentidos
 *   3. está autorizada a acolher (`canActAsListener`)
 *
 * A terceira é hoje permissiva por decisão da Sprint 2 — ela devolve
 * `role === 'listener'`. Quando a Sprint 6 trocar a implementação, o Explorar
 * passa a mostrar somente aprovados **sem que este arquivo mude**.
 */
export function isVisibleInExplore(
  candidate: ExploreCandidate,
  viewer: ExploreViewer
): boolean {
  if (!candidate?.id) return false;
  if (candidate.id === viewer.uid) return false;
  if (isBlockedEitherWay(candidate, viewer)) return false;
  if (!canActAsListener(candidate)) return false;
  return true;
}

/**
 * Lista final: visibilidade + filtros do usuário, ordenada com quem está
 * disponível agora primeiro.
 */
export function buildExploreList(
  candidates: ExploreCandidate[] | null | undefined,
  viewer: ExploreViewer,
  filters: ExploreFilters = {},
  now: number = Date.now()
): ExploreCandidate[] {
  if (!candidates) return [];

  const visible = candidates.filter((c) => {
    if (!isVisibleInExplore(c, viewer)) return false;
    if (!matchesSearch(c, filters.search)) return false;
    if (!matchesLocation(c, filters.state)) return false;
    if (!matchesTheme(c, filters.themeId)) return false;
    if (filters.onlyOnline && !isAvailableNow(c, now)) return false;
    return true;
  });

  // Disponível agora primeiro; entre iguais, ordem alfabética pelo nome público,
  // que é estável e não depende de campos que quase todo mundo tem zerados.
  return visible.sort((a, b) => {
    const aOnline = isAvailableNow(a, now) ? 1 : 0;
    const bOnline = isAvailableNow(b, now) ? 1 : 0;
    if (aOnline !== bOnline) return bOnline - aOnline;
    return getDisplayName(a, '').localeCompare(getDisplayName(b, ''), 'pt-BR');
  });
}
