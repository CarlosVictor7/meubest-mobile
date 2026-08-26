/**
 * directedSearch — textos da busca DIRECIONADA (FALAR AGORA do Explorar).
 *
 * O `listenerName` que chega por param já é o nome público ("Ana S."); mesmo
 * assim passamos por `getPublicExploreName` antes de tirar o primeiro nome,
 * para que um nome completo vindo de dado legado nunca vaze na tela.
 *
 * Funções puras.
 */
import { getFirstName, getPublicExploreName } from '@shared/utils/displayName';

export const BROADCAST_SEARCH_TITLE = 'BUSCANDO UM ACOLHEDOR';
export const BROADCAST_TIMEOUT_TITLE = 'TODOS OS NOSSOS VOLUNTÁRIOS ESTÃO OCUPADOS';

/** Primeiro nome público, ou '' quando não há nome utilizável. */
export function directedFirstName(listenerName: string | null | undefined): string {
  const publicName = getPublicExploreName({ name: listenerName }, '');
  if (!publicName) return '';
  return getFirstName({ name: publicName }, '');
}

/** "BUSCANDO ANA" — ou o título de broadcast quando não há nome. */
export function directedSearchTitle(listenerName: string | null | undefined): string {
  const first = directedFirstName(listenerName);
  return first ? `BUSCANDO ${first.toUpperCase()}` : BROADCAST_SEARCH_TITLE;
}

/** "Ana não respondeu" — ou o título genérico de timeout. */
export function directedTimeoutTitle(listenerName: string | null | undefined): string {
  const first = directedFirstName(listenerName);
  return first ? `${first} não respondeu` : BROADCAST_TIMEOUT_TITLE;
}
