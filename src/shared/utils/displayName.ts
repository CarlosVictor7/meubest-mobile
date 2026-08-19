/**
 * displayName — nome público de uma pessoa no app.
 *
 * Regra única: `preferredName` vence, `name` é o fallback.
 *
 * - `name` é o nome legado do provider (Google/Apple). Nunca é sobrescrito.
 * - `preferredName` é a escolha do usuário ("Como você quer ser chamado?").
 * - Usuários antigos não têm `preferredName` — para eles nada muda.
 *
 * Funções puras, sem dependência de React ou Firebase, para serem testáveis.
 */

/** Fallback final quando não há nenhum nome utilizável. */
export const DISPLAY_NAME_FALLBACK = 'Amigo(a)';

/** Limite de caracteres do campo "Sobre você". */
export const BIO_MAX_LENGTH = 500;

/** Limite de caracteres do nome preferido — o mesmo do `name` nas Firestore Rules (< 100). */
export const PREFERRED_NAME_MAX_LENGTH = 60;

/** Aceita qualquer objeto que tenha os dois campos de nome. */
export interface NameSource {
  preferredName?: string | null;
  name?: string | null;
}

function clean(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * Normaliza o `name` LEGADO vindo do provider para exibição.
 *
 * Causa raiz auditada em 19/08: o `+` de "Carlos+Victor Farias" não é bug de
 * decoding nosso — é o valor literal do `displayName` da conta Google, que
 * entrou no Firebase Auth assim e daí para o Firestore. Nenhuma migração:
 * o dado original fica intacto e a limpeza acontece só na leitura.
 *
 * ⚠️ APENAS o fallback `name` passa por aqui. `preferredName` é a escolha
 * explícita do usuário — se a pessoa quis um `+`, o `+` fica.
 */
export function normalizeLegacyName(name: string | null | undefined): string {
  if (typeof name !== 'string') return '';
  return name.replace(/\+/g, ' ').replace(/\s+/g, ' ').trim();
}

/**
 * Nome público completo.
 *
 * @param fallback texto usado quando não há nome nenhum. Passe `''` quando o
 *                 chamador quiser tratar a ausência por conta própria.
 */
export function getDisplayName(
  profile: NameSource | null | undefined,
  fallback: string = DISPLAY_NAME_FALLBACK
): string {
  if (!profile) return fallback;
  return clean(profile.preferredName) || normalizeLegacyName(profile.name) || fallback;
}

/**
 * Primeiro nome — usado em saudações e no nome exibido dentro do Jitsi.
 * Colapsa espaços repetidos antes de separar.
 */
export function getFirstName(
  profile: NameSource | null | undefined,
  fallback: string = DISPLAY_NAME_FALLBACK
): string {
  const full = getDisplayName(profile, '');
  if (!full) return fallback;
  const first = full.replace(/\s+/g, ' ').split(' ')[0];
  return first || fallback;
}

/**
 * Inicial para avatar textual. Sempre 1 caractere maiúsculo.
 * Usa o primeiro caractere do nome público, ou 'U' quando não há nada.
 */
export function getInitial(profile: NameSource | null | undefined): string {
  const full = getDisplayName(profile, '');
  return (full.charAt(0) || 'U').toUpperCase();
}

/**
 * Sugestão inicial para o campo "Como você quer ser chamado?" no cadastro.
 * Usa o primeiro nome do provider. Retorna '' quando não há nome — nesse caso
 * o campo nasce vazio e o usuário digita o que quiser.
 */
export function suggestPreferredName(profile: NameSource | null | undefined): string {
  return getFirstName(profile, '');
}
