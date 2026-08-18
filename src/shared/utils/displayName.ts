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
  return clean(profile.preferredName) || clean(profile.name) || fallback;
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
